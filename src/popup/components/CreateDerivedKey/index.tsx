import React, { useState } from 'react'

import Button from '@popup/components/Button'
import Input from '@popup/components/Input'

import * as nt from '@nekoton'
import { ControllerState, IControllerRpcClient } from '@popup/utils/ControllerRpcClient'
import { useForm } from 'react-hook-form'

import './style.scss'

interface ICreateDerivedKey {
	controllerRpc: IControllerRpcClient
	controllerState: ControllerState
	seed?: nt.KeyStoreEntry
	onBack?: () => void,
	onKeyCreated: (createdKey: nt.KeyStoreEntry) => void
}

const CreateDerivedKey: React.FC<ICreateDerivedKey> = ({
	controllerRpc,
	seed,
	onBack,
	onKeyCreated,
}) => {
	const { register, handleSubmit, errors } = useForm<{ password: string, name: string }>()

	const [error, setError] = useState<string>()
	const [inProcess, setInProcess] = useState(false)

	const onSubmit = async ({ password, name }: { password: string, name: string }) => {
		setInProcess(true)
		if (seed !== undefined) {
			await controllerRpc.createDerivedKey({
				accountId: seed.accountId,
				masterKey: seed.masterKey,
				name,
				password,
			}).then((key) => {
				onKeyCreated?.(key)
			}).catch((err: string) => {
				setError(err)
			}).finally(() => {
				setInProcess(false)
			})
		}
	}

	return (
		<div className="create-key__content">
			<h2 className="create-key__content-title">Create Key</h2>

			<form onSubmit={handleSubmit(onSubmit)}>
				<div className="create-key__content-form-rows">
					<Input
						name="name"
						register={register({
							required: true,
						})}
						disabled={inProcess}
						label={'Enter key name...'}
						autoFocus
						type={'text'}
					/>
					<Input
						name="password"
						register={register({
							required: true,
							minLength: 6,
						})}
						disabled={inProcess}
						label={'Enter seed password...'}
						type={'password'}
					/>
					{(errors.password || error) && (
						<div className="check-seed__content-error">
							{errors.password && 'The password is required'}
							{error}
						</div>
					)}
				</div>
				<div className="create-key__content-buttons">
					{onBack !== undefined && (
						<div className="create-key__content-buttons-back-btn">
							<Button text={'Back'} disabled={inProcess} onClick={onBack} white />
						</div>
					)}
					<Button text={'Confirm'} disabled={inProcess} onClick={handleSubmit(onSubmit)} />
				</div>
			</form>
		</div>
	)
}

export default CreateDerivedKey
