import React, { Dispatch, SetStateAction } from 'react'
import cn from 'classnames'
import { createRipple, removeRipple } from '../../common/ripple'

import './style.scss'

type IButton = {
    text: string
    type?: 'button' | 'submit' | 'reset' | undefined
    form?: string
    white?: boolean
    onClick?: (() => void) | Dispatch<SetStateAction<boolean>> | any
    disabled?: boolean
    noBorder?: boolean
}

const Button: React.FC<IButton> = ({ text, white, disabled, noBorder, onClick, type, form }) => {
    let className = cn('button', {
        _white: white,
        _blue: !white,
        _disabled: disabled,
        _noborder: noBorder,
    })

    return (
        <button
            type={type}
            form={form}
            className={className}
            onMouseDown={createRipple}
            onMouseLeave={removeRipple}
            onMouseUp={(event) => {
                removeRipple(event)
                onClick && onClick()
            }}
        >
            <div className="button__content">{text}</div>
        </button>
    )
}

export default Button
