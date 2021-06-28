import CreateDerivedKey from '@popup/components/CreateDerivedKey'
import React, { useMemo, useState } from 'react'
import classNames from 'classnames'

import * as nt from '@nekoton'
import CreateSeed from '@popup/components/CreateSeed'
import ManageSeed from '@popup/components/ManageSeed'
import Arrow from '@popup/img/arrow.svg'
import TonLogo from '@popup/img/ton-logo.svg'
import { ControllerState, IControllerRpcClient } from '@popup/utils/ControllerRpcClient'
import { convertAddress } from '@shared/utils'

import './style.scss'


interface IManageSeeds {
	controllerRpc: IControllerRpcClient
	controllerState: ControllerState
}

enum ManageSeedsStep {
	MANAGE_SEED,
	CREATE_SEED,
	MANAGE_DERIVED_KEY,
	CREATE_DERIVED_KEY,
	MANAGE_ACCOUNT,
	CREATE_ACCOUNT,
}

const ManageSeeds: React.FC<IManageSeeds> = ({ controllerRpc, controllerState  }) => {
	const [step, setStep] = useState<ManageSeedsStep | null>(null)
	const [currentSeed, setCurrentSeed] = useState<nt.KeyStoreEntry>()
	const [currentKey, setCurrentKey] = useState<nt.KeyStoreEntry>()

	const seeds = useMemo(() => Object.values(controllerState.storedKeys).filter(
		key => key.accountId === 0
	), [controllerState.storedKeys])

	const onSeedCreated = (createdSeed: nt.KeyStoreEntry) => {
		setCurrentSeed(createdSeed)
		setStep(ManageSeedsStep.MANAGE_SEED)
	}

	const onCreateDerivedKey = () => {
		setStep(ManageSeedsStep.CREATE_DERIVED_KEY)
	}

	const onDerivedKeyCreated = (createdDerivedKey: nt.KeyStoreEntry) => {
		setCurrentKey(createdDerivedKey)
		setStep(ManageSeedsStep.MANAGE_DERIVED_KEY)
	}

	return (
		<>
			{step == null && (
				<div className="manage-seeds__content">
					<h2 className="manage-seeds__content-title">Manage seeds & subscriptions</h2>

					<div className="manage-seeds__content-header">Seeds phrases</div>

					<div className="manage-seeds__divider" />

					<ul className="manage-seeds__list">
						{seeds.map(seed => {
							const isActive = controllerState.selectedSeed === seed.masterKey
							return (
								<li key={seed.masterKey}>
									<div
										role="button"
										className={classNames('manage-seeds__list-item', {
											'manage-seeds__list-item--active': isActive
										})}
										onClick={() => {
											setStep(ManageSeedsStep.MANAGE_SEED)
											setCurrentSeed(seed)
										}}
									>
										<img src={TonLogo} alt="" className="manage-seeds__list-item-logo" />
										<div className="manage-seeds__list-item-title">
											{controllerState.seedsNames?.[seed.masterKey] || convertAddress(seed.masterKey)}
											{isActive && ' (current)'}
										</div>
										<img src={Arrow} alt="" style={{ height: 24, width: 24 }} />
									</div>
								</li>
							)
						})}
						<li>
							<div className="manage-seeds__list-item">
								<a
									role="button"
									onClick={() => {
										setStep(ManageSeedsStep.CREATE_SEED)
									}}
								>
									+ Add new
								</a>
							</div>
						</li>
					</ul>
				</div>
			)}
			{step === ManageSeedsStep.CREATE_SEED && (
				<CreateSeed
					controllerRpc={controllerRpc}
					onSeedCreated={onSeedCreated}
				/>
			)}
			{step === ManageSeedsStep.MANAGE_SEED && (
				<ManageSeed
					controllerRpc={controllerRpc}
					controllerState={controllerState}
					currentSeed={currentSeed}
					onCreateKey={onCreateDerivedKey}
				/>
			)}
			{step === ManageSeedsStep.CREATE_DERIVED_KEY && (
				<CreateDerivedKey
					controllerRpc={controllerRpc}
					controllerState={controllerState}
					seed={currentSeed}
					onKeyCreated={onDerivedKeyCreated}
				/>
			)}
		</>
	)
}

export default ManageSeeds
