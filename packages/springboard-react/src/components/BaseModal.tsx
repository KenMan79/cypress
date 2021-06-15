import * as React from 'react'
import { CloseButton } from './CloseButton'
// import styles from './styles/BaseModal.module.scss'

interface BaseModalProps {
  onClose?: React.MouseEventHandler<HTMLElement>
}

export const BaseModal: React.FC<BaseModalProps> = (props) => {
  const { onClose = () => {} } = props

  return (
    <div className="overlay" onClick={onClose} role="dialog">
      <div className="wrapper">
        <CloseButton onClick={onClose} />
        <div className="content">{props.children}</div>
      </div>
    </div>
  )
}