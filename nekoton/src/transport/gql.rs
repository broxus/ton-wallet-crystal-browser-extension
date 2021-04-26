use std::convert::TryInto;
use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use futures::channel::oneshot;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::*;

use nt::transport::gql;

use crate::utils::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
extern "C" {
    pub type GqlSender;

    #[wasm_bindgen(method)]
    pub fn send(this: &GqlSender, data: &str, handler: GqlQuery);
}

unsafe impl Send for GqlSender {}
unsafe impl Sync for GqlSender {}

#[wasm_bindgen]
#[derive(Clone)]
pub struct GqlConnection {
    #[wasm_bindgen(skip)]
    pub inner: Arc<GqlConnectionImpl>,
}

#[wasm_bindgen]
impl GqlConnection {
    #[wasm_bindgen(constructor)]
    pub fn new(sender: GqlSender) -> GqlConnection {
        Self {
            inner: Arc::new(GqlConnectionImpl {
                sender: Arc::new(sender),
            }),
        }
    }

    #[wasm_bindgen(js_name = "subscribeToTonWallet")]
    pub fn subscribe_to_main_wallet(
        &self,
        public_key: &str,
        contract_type: crate::core::ton_wallet::ContractType,
        handler: crate::core::ton_wallet::TonWalletSubscriptionHandlerImpl,
    ) -> Result<PromiseTonWallet, JsValue> {
        use crate::core::ton_wallet::*;

        let public_key = parse_public_key(&public_key)?;
        let contract_type = contract_type.try_into()?;

        let transport = Arc::new(self.make_transport());
        let handler = Arc::new(TonWalletSubscriptionHandler::from(handler));

        Ok(JsCast::unchecked_into(future_to_promise(async move {
            let wallet = nt::core::ton_wallet::TonWallet::subscribe(
                transport.clone() as Arc<dyn nt::transport::Transport>,
                public_key,
                contract_type,
                handler,
            )
            .await
            .handle_error()?;

            Ok(JsValue::from(TonWallet::new(transport, wallet)))
        })))
    }

    #[wasm_bindgen(js_name = "subscribeToTokenWallet")]
    pub fn subscribe_to_token_wallet(
        &self,
        owner: &str,
        root_token_contract: &str,
        handler: crate::core::token_wallet::TokenWalletSubscriptionHandlerImpl,
    ) -> Result<PromiseTokenWallet, JsValue> {
        use crate::core::token_wallet::*;

        let owner = parse_address(owner)?;
        let root_token_contract = parse_address(root_token_contract)?;

        let transport = Arc::new(self.make_transport());
        let handler = Arc::new(TokenWalletSubscriptionHandler::from(handler));

        Ok(JsCast::unchecked_into(future_to_promise(async move {
            let wallet = nt::core::token_wallet::TokenWallet::subscribe(
                transport.clone() as Arc<dyn nt::transport::Transport>,
                owner,
                root_token_contract,
                handler,
            )
            .await
            .handle_error()?;

            Ok(JsValue::from(TokenWallet::new(transport, wallet)))
        })))
    }

    #[wasm_bindgen(js_name = "getLatestBlock")]
    pub fn get_latest_block(&self, address: &str) -> Result<PromiseLatestBlock, JsValue> {
        let address = parse_address(address)?;
        let transport = self.make_transport();

        Ok(JsCast::unchecked_into(future_to_promise(async move {
            let latest_block = transport.get_latest_block(&address).await.handle_error()?;
            Ok(make_latest_block(latest_block))
        })))
    }

    #[wasm_bindgen(js_name = "waitForNextBlock")]
    pub fn wait_for_next_block(
        &self,
        current_block_id: String,
        address: &str,
        timeout: u32,
    ) -> Result<PromiseString, JsValue> {
        let address = parse_address(address)?;
        let transport = self.make_transport();

        Ok(JsCast::unchecked_into(future_to_promise(async move {
            let next_block = transport
                .wait_for_next_block(
                    &current_block_id,
                    &address,
                    std::time::Duration::from_secs(timeout as u64),
                )
                .await
                .handle_error()?;
            Ok(JsValue::from(next_block))
        })))
    }
}

impl GqlConnection {
    pub fn make_transport(&self) -> gql::GqlTransport {
        gql::GqlTransport::new(self.inner.clone())
    }
}

pub struct GqlConnectionImpl {
    sender: Arc<GqlSender>,
}

#[async_trait]
impl nt::external::GqlConnection for GqlConnectionImpl {
    async fn post(&self, data: &str) -> Result<String> {
        let (tx, rx) = oneshot::channel();

        self.sender.send(data, GqlQuery { tx });

        let response = rx.await.unwrap_or(Err(QueryError::RequestDropped))?;
        Ok(response)
    }
}

type GqlQueryResult = Result<String, QueryError>;

#[wasm_bindgen]
pub struct GqlQuery {
    #[wasm_bindgen(skip)]
    pub tx: oneshot::Sender<GqlQueryResult>,
}

#[wasm_bindgen]
impl GqlQuery {
    #[wasm_bindgen(js_name = "onReceive")]
    pub fn on_receive(self, data: String) {
        let _ = self.tx.send(Ok(data));
    }

    #[wasm_bindgen(js_name = "onError")]
    pub fn on_error(self, _: JsValue) {
        let _ = self.tx.send(Err(QueryError::RequestFailed));
    }

    #[wasm_bindgen(js_name = "onTimeout")]
    pub fn on_timeout(self) {
        let _ = self.tx.send(Err(QueryError::TimeoutReached));
    }
}

#[derive(thiserror::Error, Debug)]
pub enum QueryError {
    #[error("Request dropped unexpectedly")]
    RequestDropped,
    #[error("Timeout reached")]
    TimeoutReached,
    #[error("Request failed")]
    RequestFailed,
}

#[wasm_bindgen(typescript_custom_section)]
const LATEST_BLOCK: &'static str = r#"
export type LatestBlock = {
    id: string,
    endLt: string,
    genUtime: number,
};
"#;

fn make_latest_block(latest_block: nt::transport::gql::LatestBlock) -> JsValue {
    ObjectBuilder::new()
        .set("id", latest_block.id)
        .set("endLt", latest_block.end_lt.to_string())
        .set("genUtime", latest_block.gen_utime)
        .build()
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Promise<TonWallet>")]
    pub type PromiseTonWallet;

    #[wasm_bindgen(typescript_type = "Promise<TokenWallet>")]
    pub type PromiseTokenWallet;

    #[wasm_bindgen(typescript_type = "Promise<LatestBlock>")]
    pub type PromiseLatestBlock;
}