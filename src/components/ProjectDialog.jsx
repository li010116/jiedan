import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Check, Download, LoaderCircle, X } from "lucide-react";
import "./ProjectDialog.css";

const SERVICES = ["网站开发", "小程序 / App", "AI 应用", "技术支持"];
const BUDGETS = [
  "尚未确定，想先聊聊",
  "5,000 元以内",
  "5,000–15,000 元",
  "15,000–50,000 元",
  "50,000 元以上",
];

function normalizeService(service) {
  return SERVICES.includes(service) ? service : SERVICES[0];
}
function emptyFields(service) {
  return {
    service: normalizeService(service),
    name: "",
    contact: "",
    budget: BUDGETS[0],
    description: "",
    website: "",
  };
}

export default function ProjectDialog({
  open,
  onClose,
  initialService = "网站开发",
  studioName = "MOGUSTACK",
}) {
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const preparedRequestRef = useRef(null);
  const submittingRef = useRef(false);
  const submittedRef = useRef(null);
  const controllerRef = useRef(null);
  const id = useId();
  const [step, setStep] = useState("form");
  const [downloaded, setDownloaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [fields, setFields] = useState(() => emptyFields(initialService));

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    // Completed inquiries stay as receipts when reopened; starting another is explicit.
    if (!submittedRef.current) {
      setStep("form");
      setFields((previous) => ({
        ...previous,
        service: normalizeService(initialService),
      }));
    }
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const existingPadding =
        Number.parseFloat(
          window.getComputedStyle(document.body).paddingRight,
        ) || 0;
      document.body.style.paddingRight = `${existingPadding + scrollbarWidth}px`;
    }
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, [open, initialService]);

  useEffect(() => {
    dialogRef.current?.querySelector('.brief-scroll-body')?.scrollTo(0, 0);
    if (open && step !== "form")
      titleRef.current?.focus({ preventScroll: true });
  }, [open, step]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  function updateField(event) {
    const { name, value } = event.target;
    event.target.setCustomValidity("");
    setFields((previous) => ({ ...previous, [name]: value }));
    setSubmitError("");
  }

  function prepareBrief(event) {
    event.preventDefault();
    const form = event.currentTarget;
    for (const fieldName of ["name", "contact", "description"]) {
      const input = form.elements.namedItem(fieldName);
      if (!input.value.trim()) {
        input.setCustomValidity("请填写此项内容。");
        input.reportValidity();
        return;
      }
    }
    if (!form.reportValidity()) return;
    const normalized = {
      ...fields,
      name: fields.name.trim(),
      contact: fields.contact.trim(),
      description: fields.description.trim(),
    };
    const signature = JSON.stringify(normalized);
    // Unchanged requests reuse their key, including retries after a network timeout.
    if (preparedRequestRef.current?.signature !== signature) {
      preparedRequestRef.current = {
        signature,
        payload: { ...normalized, idempotencyKey: crypto.randomUUID() },
      };
    }
    setFields(normalized);
    setDownloaded(false);
    setSubmitError("");
    setStep("summary");
    dialogRef.current.scrollTop = 0;
  }

  async function submitBrief() {
    if (
      submittingRef.current ||
      submittedRef.current ||
      !preparedRequestRef.current
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preparedRequestRef.current.payload),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "暂时无法提交，请稍后重试。");
      if (!data.inquiry?.id || !data.inquiry?.reference)
        throw new Error(
          "未能确认提交结果，请重试。重复尝试不会重复创建相同需求。",
        );
      submittedRef.current = data.inquiry;
      setReceipt(data.inquiry);
      setStep("success");
      setDownloaded(false);
      dialogRef.current.scrollTop = 0;
    } catch (error) {
      setSubmitError(
        error.name === "AbortError"
          ? "连接超时，尚未确认提交结果。请重试，相同需求不会重复创建。"
          : error instanceof TypeError
            ? "网络连接失败，请检查连接后重试。已填写的内容仍然保留。"
            : error.message,
      );
    } finally {
      window.clearTimeout(timeout);
      controllerRef.current = null;
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function startNewBrief() {
    submittedRef.current = null;
    preparedRequestRef.current = null;
    setReceipt(null);
    setFields(emptyFields(initialService));
    setStep("form");
    setSubmitError("");
    setDownloaded(false);
    dialogRef.current.scrollTop = 0;
  }

  function closeDialog() {
    if (!submittingRef.current) onClose();
  }

  function downloadBrief() {
    const date = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const content = [
      `${studioName} · 项目需求单`,
      `生成日期：${date}`,
      receipt ? `需求编号：${receipt.reference}` : "提交状态：尚未提交",
      "",
      `项目类型：${fields.service}`,
      `称呼：${fields.name}`,
      `联系方式：${fields.contact}`,
      `预算范围：${fields.budget}`,
      "",
      "项目描述",
      "────────────────────",
      fields.description,
      "",
      receipt
        ? "此需求已提交到工作室，可使用需求编号与开发者核对。"
        : "此需求尚未提交。请在页面确认内容后点击“提交项目需求”。",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    const filename =
      studioName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").slice(0, 50) ||
      "项目";
    link.href = url;
    link.download = `${filename}-项目需求单-${date.replaceAll("/", "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }

  function closeFromBackdrop(event) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeDialog();
  }

  return (
    <dialog
      ref={dialogRef}
      className="project-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-intro`}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={closeFromBackdrop}
    >
      <button
        className="project-dialog-close"
        type="button"
        onClick={closeDialog}
        disabled={submitting}
        aria-label="关闭项目咨询"
      >
        <X size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <div className="project-dialog-heading">
        <p className="project-dialog-eyebrow">LET’S BUILD SOMETHING.</p>
        <p className="brief-step-label">{step === "form" ? "01 / 填写需求" : step === "summary" ? "02 / 核对并提交" : "03 / 提交完成"}</p>
        <h2 id={`${id}-title`} ref={titleRef} tabIndex={-1}>
          {step === "form"
            ? "从你的想法开始。"
            : step === "success"
              ? "好想法，已经收到。"
              : "确认一下，我们就开始。"}
        </h2>
        <p id={`${id}-intro`}>
          {step === "form"
            ? "告诉我你想做什么，我们一起找到合适的实现方式。"
            : step === "success"
              ? "你的需求已成功提交，工作室会通过你留下的联系方式与你沟通。"
              : "检查项目需求和联系方式，确认后再提交给工作室。"}
        </p>
      </div>
      {step === "form" ? (
        <form className="brief-form" onSubmit={prepareBrief}>
          <div className="brief-form-fields brief-scroll-body">
          <div className="brief-honeypot" aria-hidden="true">
            <label htmlFor={`${id}-website`}>Website</label>
            <input
              id={`${id}-website`}
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={fields.website}
              onChange={updateField}
            />
          </div>
          <fieldset className="brief-services">
            <legend>你想做哪一类项目？</legend>
            <div className="brief-service-options">
              {SERVICES.map((service) => (
                <label className="brief-service-option" key={service}>
                  <input
                    type="radio"
                    name="service"
                    value={service}
                    checked={fields.service === service}
                    onChange={updateField}
                  />
                  <span>{service}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="brief-field-row">
            <label className="brief-field" htmlFor={`${id}-name`}>
              怎么称呼你 <span className="brief-required">*</span>
              <input
                id={`${id}-name`}
                name="name"
                autoComplete="name"
                placeholder="你的称呼"
                maxLength={40}
                value={fields.name}
                onChange={updateField}
                required
              />
            </label>
            <label className="brief-field" htmlFor={`${id}-contact`}>
              联系方式 <span className="brief-required">*</span>
              <input
                id={`${id}-contact`}
                name="contact"
                placeholder="邮箱或微信号"
                maxLength={120}
                value={fields.contact}
                onChange={updateField}
                required
              />
            </label>
          </div>
          <label className="brief-field" htmlFor={`${id}-budget`}>
            预计预算
            <select
              id={`${id}-budget`}
              name="budget"
              value={fields.budget}
              onChange={updateField}
            >
              {BUDGETS.map((budget) => (
                <option key={budget} value={budget}>
                  {budget}
                </option>
              ))}
            </select>
          </label>
          <label className="brief-field" htmlFor={`${id}-description`}>
            简单说说你的想法 <span className="brief-required">*</span>
            <textarea
              id={`${id}-description`}
              name="description"
              placeholder="希望解决什么问题？有哪些核心功能？也可以说说你的期望上线时间。"
              rows={4}
              maxLength={3000}
              value={fields.description}
              onChange={updateField}
              required
            />
          </label>
          </div>
          <div className="brief-action-bar">
          <button className="brief-primary-button" type="submit">
            下一步，确认需求{" "}
            <ArrowUpRight size={19} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <p className="brief-local-note">
            确认提交后，联系方式与需求将保存到工作室，用于项目沟通。
          </p>
          </div>
        </form>
      ) : (
        <div className="brief-summary">
          <div className="brief-summary-body brief-scroll-body">
          {receipt ? (
            <div className="brief-receipt" role="status">
              <Check size={20} aria-hidden="true" />
              <div>
                <span>需求已收到</span>
                <strong>{receipt.reference}</strong>
              </div>
            </div>
          ) : null}
          <dl className="brief-summary-details">
            <div>
              <dt>项目类型</dt>
              <dd>{fields.service}</dd>
            </div>
            <div>
              <dt>你的称呼</dt>
              <dd>{fields.name}</dd>
            </div>
            <div>
              <dt>联系方式</dt>
              <dd>{fields.contact}</dd>
            </div>
            <div>
              <dt>预计预算</dt>
              <dd>{fields.budget}</dd>
            </div>
            <div className="brief-summary-description">
              <dt>项目描述</dt>
              <dd>{fields.description}</dd>
            </div>
          </dl>
          {submitError ? (
            <p className="brief-submit-error" role="alert">
              {submitError}
            </p>
          ) : null}
          </div>
          <div className="brief-action-bar">
          <div className="brief-summary-actions">
            {receipt ? (
              <>
                <button
                  className="brief-primary-button"
                  type="button"
                  onClick={downloadBrief}
                >
                  下载需求单 <Download size={18} aria-hidden="true" />
                </button>
                <button
                  className="brief-secondary-button"
                  type="button"
                  onClick={closeDialog}
                >
                  完成
                </button>
              </>
            ) : (
              <>
                <button
                  className="brief-primary-button"
                  type="button"
                  onClick={submitBrief}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      正在提交{" "}
                      <LoaderCircle
                        size={18}
                        className="brief-spinner"
                        aria-hidden="true"
                      />
                    </>
                  ) : (
                    <>
                      提交项目需求 <ArrowUpRight size={18} aria-hidden="true" />
                    </>
                  )}
                </button>
                <button
                  className="brief-secondary-button"
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setStep("form");
                    setSubmitError("");
                  }}
                >
                  返回修改
                </button>
              </>
            )}
          </div>
          {submitting ? (
            <p className="brief-local-note" role="status">
              正在安全保存你的需求，请稍候…
            </p>
          ) : null}
          {downloaded ? (
            <p className="brief-download-status" role="status">
              <Check size={15} aria-hidden="true" />{" "}
              已生成下载文件，请在浏览器中查看。
            </p>
          ) : null}
          {receipt ? (
            <button
              className="brief-new-button"
              type="button"
              onClick={startNewBrief}
            >
              还有一个想法？提交新的需求
            </button>
          ) : (
            <p className="brief-local-note">
              提交后，工作室可查看以上需求，并通过你的联系方式与你沟通。
            </p>
          )}
          </div>
        </div>
      )}
    </dialog>
  );
}
