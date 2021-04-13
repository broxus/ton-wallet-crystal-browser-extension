use std::sync::Arc;

use anyhow::Result;
use async_trait::async_trait;
use ed25519_dalek::PublicKey;
use futures::channel::oneshot;
use std::convert::TryFrom;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::*;

use libnekoton::core;
use libnekoton::external;
use libnekoton::transport::{gql, Transport};

use crate::utils::{HandleError, PromiseVoid};

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
    pub fn subscribe_main_wallet(
        &self,
        public_key: String,
        contract_type: crate::core::ContractType,
        handler: crate::core::wallet::TonWalletNotificationHandlerImpl,
    ) -> Result<PromiseTonWalletSubscription, JsValue> {
        let public_key =
            PublicKey::from_bytes(&hex::decode(public_key).handle_error()?).handle_error()?;

        let contract_type = core::ton_wallet::ContractType::try_from(contract_type)?;

        let transport = Arc::new(self.make_transport());
        let handler = Arc::new(crate::core::wallet::TonWalletNotificationHandler::from(
            handler,
        ));

        Ok(JsCast::unchecked_into(future_to_promise(async move {
            let subscription = core::ton_wallet::TonWallet::subscribe(
                transport.clone() as Arc<dyn Transport>,
                public_key,
                contract_type,
                handler,
            )
            .await
            .handle_error()?;

            let address = subscription.address().to_string();
            let public_key = hex::encode(subscription.public_key().as_bytes());
            let contract_type = subscription.contract_type();

            let inner = Arc::new(crate::core::wallet::TonWalletImpl::new(
                transport,
                subscription,
            ));

            Ok(JsValue::from(crate::core::wallet::TonWallet {
                address,
                public_key,
                contract_type,
                inner,
            }))
        })))
    }

    #[wasm_bindgen(js_name = "testGetConfig")]
    pub fn test_get_config(&self) -> PromiseVoid {
        let transport = self.make_transport();

        JsCast::unchecked_into(future_to_promise(async move {
            let config = transport.get_blockchain_config().await.handle_error()?;
            log(&format!("{:?}", config.raw_config()));

            Ok(JsValue::undefined())
        }))
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
impl external::GqlConnection for GqlConnectionImpl {
    async fn post(&self, data: &str) -> Result<String> {
        let (tx, rx) = oneshot::channel();

        self.sender.send(data, GqlQuery { tx });

        let response = rx
            .await
            .unwrap_or_else(|_| Err(QueryError::RequestDropped))?;
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

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Promise<TonWalletSubscription>")]
    pub type PromiseTonWalletSubscription;
}
