import React, { useRef } from 'react'

import Button from '@popup/components/Button'
import ConnectLedger from '@popup/components/ConnectLedger'
import SelectLedgerAccount from '@popup/components/SelectLedgerAccount'

const LEDGER_BRIDGE_URL = 'https://broxus.github.io/ton-ledger-bridge'

interface ISelectWallet {
    onSubmit: () => void
    onBack?: () => void
    onSkip?: () => void
}

const SelectLedgerKey: React.FC<ISelectWallet> = ({ onSubmit, onBack, onSkip }) => {
    const ref = useRef<HTMLIFrameElement>(null)

    return (
        <div className="select-wallet">
            <div className="select-wallet__content">
                <div className="select-wallet__content-options">
                    {/*<ConnectLedger onBack={onBack} onNext={onSubmit} />*/}
                    {/*<SelectLedgerAccount onBack={onBack} onNext={onSubmit} />*/}
                    <iframe
                        allow="hid"
                        src={LEDGER_BRIDGE_URL}
                        ref={ref}
                        onLoad={() => {
                            const message = {
                                target: 'LEDGER-IFRAME',
                                action: 'ledger-get-configuration',
                            }

                            const handleMessage = (reply: any) => {
                                if (reply.data?.success === true) {
                                }
                                window.removeEventListener('message', handleMessage)
                            }
                            window.addEventListener('message', handleMessage)

                            ref.current?.contentWindow?.postMessage(message, '*')
                        }}
                    />
                </div>
                <div className="select-wallet__content-buttons">
                    <Button text={'Next'} disabled={false} onClick={() => onSubmit()} />
                    {onBack && <Button text={'Back'} white onClick={onBack} />}
                    {onSkip && <Button text={'Skip'} white onClick={onSkip} />}
                </div>
            </div>
        </div>
    )
}

export default SelectLedgerKey