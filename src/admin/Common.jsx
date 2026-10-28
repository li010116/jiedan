import React, { useEffect, useId, useRef } from "react";
import { Inbox, X } from "lucide-react";

export const STATUS = {
  new: "待处理",
  contacted: "已联系",
  in_progress: "进行中",
  closed: "已结束",
};

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(
    typeof value === "number" && value < 1e12 ? value * 1000 : value,
  );
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
      }).format(date);
}

export function Notice({ children, success = false }) {
  return children ? (
    <p
      className={`admin-notice${success ? " admin-notice-success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {children}
    </p>
  ) : null;
}

export function Empty({ title, children }) {
  return (
    <div className="admin-empty">
      <Inbox size={32} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`admin-dialog${wide ? " admin-dialog-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const box = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="admin-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="admin-icon-button"
          onClick={onClose}
          aria-label="关闭弹窗"
        >
          <X size={20} />
        </button>
      </div>
      <div className="admin-dialog-body">{children}</div>
    </dialog>
  );
}
