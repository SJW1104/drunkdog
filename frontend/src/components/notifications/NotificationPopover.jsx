/* eslint-disable react/prop-types */
import Icon from '../ui/Icon'

export default function NotificationPopover({
  notifications,
  setNotifications,
  navigate,
  onClose,
}) {
  const unreadCount = notifications.filter((notice) => !notice.read).length

  const readAll = () => {
    setNotifications((current) => current.map((notice) => ({ ...notice, read: true })))
  }

  const openNotice = (noticeId) => {
    setNotifications((current) => current.map((notice) => (
      notice.id === noticeId ? { ...notice, read: true } : notice
    )))
    onClose()
    navigate('exchange')
  }

  return (
    <div className="notification-popover-layer" onMouseDown={onClose}>
      <aside
        className="notification-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-popover-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="notification-popover-head">
          <div>
            <span><Icon name="bell" size={15} /> NEW MESSAGE</span>
            <h2 id="notification-popover-title">알림</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="알림 닫기">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="notification-popover-summary">
          <p>
            {unreadCount
              ? `새로운 알림이 ${unreadCount}개 있어요`
              : '새로운 알림을 모두 확인했어요'}
          </p>
          {unreadCount ? <button type="button" onClick={readAll}>모두 읽음</button> : null}
        </div>

        <div className="notification-popover-list">
          {notifications.map((notice) => (
            <button
              type="button"
              key={notice.id}
              className={notice.read ? 'is-read' : ''}
              onClick={() => openNotice(notice.id)}
            >
              <i>
                <Icon
                  name={notice.type === 'complete'
                    ? 'check'
                    : notice.type === 'deadline'
                      ? 'clock'
                      : 'exchange'}
                  size={19}
                />
              </i>
              <span>
                <b>{notice.title}</b>
                <p>{notice.body}</p>
                <small>{notice.time}</small>
              </span>
              {!notice.read ? <em /> : null}
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
