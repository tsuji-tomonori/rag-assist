export type IconName =
  | "logo"
  | "chat"
  | "clock"
  | "star"
  | "document"
  | "folder"
  | "settings"
  | "paperclip"
  | "send"
  | "chevron"
  | "check"
  | "share"
  | "warning"
  | "expand"
  | "plus"
  | "download"
  | "trash"
  | "inbox"
  | "copy"
  | "gauge"
  | "stop"
  | "close"

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className={`icon icon-${name}`} viewBox="0 0 24 24" aria-hidden="true">
      {getIconPath(name)}
    </svg>
  )
}

function getIconPath(name: IconName) {
  switch (name) {
    case "logo":
      return <path d="M5 4h9a5 5 0 0 1 5 5v6.5a4.5 4.5 0 0 1-4.5 4.5H10l-5 3v-3.2A5 5 0 0 1 1 15V8a4 4 0 0 1 4-4Zm2 6h7v2H7v-2Zm0 4h5v2H7v-2Zm10 3.2 3 1.8v-2.2a4 4 0 0 0 3-3.8V8.5a3.5 3.5 0 0 0-3.5-3.5h-.9A6.8 6.8 0 0 1 21 10v5a3 3 0 0 1-4 2.8v-.6Z" />
    case "chat":
      return <path d="M4 5h16v11H8l-4 3V5Zm4 4v2h8V9H8Zm0 4v2h5v-2H8Z" />
    case "clock":
      return <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm1 4v4.4l3.2 1.9-1 1.7-4.2-2.5V7h2Z" />
    case "star":
      return <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    case "document":
      return <path d="M6 3h8l4 4v14H6V3Zm7 2.5V8h2.5L13 5.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" />
    case "folder":
      return <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm2 2v10h14V8h-8l-2-2H5v2Z" />
    case "settings":
      return <path d="m13.3 3 .6 2a7.8 7.8 0 0 1 1.7.7l1.9-1 2 2-1 1.9c.3.5.5 1.1.7 1.7l2 .6v2.8l-2 .6a7.8 7.8 0 0 1-.7 1.7l1 1.9-2 2-1.9-1c-.5.3-1.1.5-1.7.7l-.6 2h-2.8l-.6-2a7.8 7.8 0 0 1-1.7-.7l-1.9 1-2-2 1-1.9a7.8 7.8 0 0 1-.7-1.7l-2-.6v-2.8l2-.6c.2-.6.4-1.2.7-1.7l-1-1.9 2-2 1.9 1c.5-.3 1.1-.5 1.7-.7l.6-2h2.8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    case "paperclip":
      return <path d="m7.4 13.6 7-7a3.3 3.3 0 0 1 4.7 4.7l-8 8a5 5 0 0 1-7.1-7.1l8.4-8.4 1.4 1.4-8.4 8.4a3 3 0 0 0 4.3 4.3l8-8a1.3 1.3 0 1 0-1.9-1.9l-7 7a.9.9 0 0 0 1.3 1.3l5.9-5.9 1.4 1.4-5.9 5.9a2.9 2.9 0 0 1-4.1-4.1Z" />
    case "send":
      return <path d="M3 20 21 12 3 4v6l10 2-10 2v6Z" />
    case "chevron":
      return <path d="m7 9 5 5 5-5 1.4 1.4L12 16.8l-6.4-6.4L7 9Z" />
    case "check":
      return <path d="M9.5 16.6 4.8 12l1.4-1.4 3.3 3.2 8.3-8.4 1.4 1.4-9.7 9.8Z" />
    case "share":
      return <path d="M18 16.1a3 3 0 0 0-2.3 1.1L8.8 13a3.3 3.3 0 0 0 0-2l6.9-4.1A3 3 0 1 0 15 5a3.3 3.3 0 0 0 .1.8L8.2 9.9a3 3 0 1 0 0 4.2l6.9 4.1a3.3 3.3 0 0 0-.1.8 3 3 0 1 0 3-2.9Z" />
    case "warning":
      return <path d="M12 3 22 20H2L12 3Zm-1 6v5h2V9h-2Zm0 7v2h2v-2h-2Z" />
    case "expand":
      return <path d="M4 4h7v2H7.4l4.2 4.2-1.4 1.4L6 7.4V11H4V4Zm9 0h7v7h-2V7.4l-4.2 4.2-1.4-1.4L16.6 6H13V4ZM6 16.6l4.2-4.2 1.4 1.4L7.4 18H11v2H4v-7h2v3.6Zm7.8-4.2 4.2 4.2V13h2v7h-7v-2h3.6l-4.2-4.2 1.4-1.4Z" />
    case "plus":
      return <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
    case "download":
      return <path d="M11 3h2v9.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3V3Zm-6 15h14v3H5v-3Z" />
    case "trash":
      return <path d="M8 3h8l1 2h4v2H3V5h4l1-2Zm-2 6h12l-1 12H7L6 9Zm3 2 .5 8h2L11 11H9Zm4 0-.5 8h2l.5-8h-2Z" />
    case "inbox":
      return <path d="M4 4h16l2 9v7H2v-7l2-9Zm1.6 2-1.3 6h4.4l1.2 2h4.2l1.2-2h4.4l-1.3-6H5.6ZM4 14v4h16v-4h-3.5l-1.2 2H8.7l-1.2-2H4Z" />
    case "copy":
      return <path d="M8 2h10a2 2 0 0 1 2 2v10h-2V4H8V2Zm-4 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v12h10V8H4Z" />
    case "gauge":
      return <path d="M12 4a10 10 0 0 1 10 10 9.8 9.8 0 0 1-2 6H4a9.8 9.8 0 0 1-2-6A10 10 0 0 1 12 4Zm0 2a8 8 0 0 0-8 8c0 1.5.4 2.9 1.2 4h13.6c.8-1.1 1.2-2.5 1.2-4a8 8 0 0 0-8-8Zm4.9 4.7-3.8 5.5a2 2 0 1 1-1.6-1.2l3.8-5.5 1.6 1.2Z" />
    case "stop":
      return <path d="M7 7h10v10H7V7Z" />
    case "close":
      return <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
  }
}
