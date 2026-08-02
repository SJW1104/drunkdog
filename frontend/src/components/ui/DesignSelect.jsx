/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export default function DesignSelect({ value, onChange, options, ariaLabel, compact = false }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, upward: false })
  const buttonRef = useRef(null)
  const normalized = options.map((option) => (
    Array.isArray(option)
      ? { value: option[0], label: option[1] }
      : { value: option, label: String(option) }
  ))
  const selected = normalized.find((option) => String(option.value) === String(value)) || normalized[0]

  const toggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const estimatedHeight = Math.min(normalized.length * 43 + 16, 330)
      const upward = window.innerHeight - rect.bottom < estimatedHeight + 12 && rect.top > estimatedHeight

      setPosition({
        top: upward ? rect.top - 8 : rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, compact ? 96 : 170),
        upward,
      })
    }

    setOpen((current) => !current)
  }

  useEffect(() => {
    if (!open) return undefined

    const close = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const selectOption = (nextValue) => {
    onChange(nextValue)
    setOpen(false)
  }

  return (
    <div className={`design-select ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''}`}>
      <button
        ref={buttonRef}
        className="design-select-trigger"
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{selected?.label}</span>
        <Icon name="chevron" size={18} />
      </button>

      {open ? (
        <>
          <button
            className="design-select-backdrop"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="선택 목록 닫기"
          />
          <div
            className={`design-select-menu ${position.upward ? 'opens-up' : ''}`}
            role="listbox"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {normalized.map((option) => {
              const active = String(option.value) === String(value)

              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? 'is-selected' : ''}
                  key={option.value}
                  onClick={() => selectOption(option.value)}
                >
                  <span>{option.label}</span>
                  {active ? <Icon name="check" size={16} /> : null}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
