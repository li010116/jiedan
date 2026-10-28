import { z } from "zod";

export const SERVICES = ["网站开发", "小程序 / App", "AI 应用", "技术支持"];
export const BUDGETS = [
  "尚未确定，想先聊聊",
  "5,000 元以内",
  "5,000–15,000 元",
  "15,000–50,000 元",
  "50,000 元以上",
];
export const STATUSES = ["new", "contacted", "in_progress", "closed"];
const text = (maximum) =>
  z
    .string()
    .trim()
    .min(1, "请填写必填项")
    .max(maximum, `最多填写 ${maximum} 个字符`);

export const inquirySchema = z
  .object({
    service: z.enum(SERVICES),
    name: text(40),
    contact: text(120),
    budget: z.enum(BUDGETS),
    description: text(3000),
    website: z.string().max(500).optional().default(""),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
export const inquiryUpdateSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    notes: z.string().trim().max(10000).optional(),
  })
  .strict()
  .refine(
    (v) => v.status !== undefined || v.notes !== undefined,
    "请提供要修改的状态或备注",
  );

function validImage(value) {
  if (/^\/assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes(".."))
    return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const projectSchema = z
  .object({
    title: text(100),
    category: text(80),
    image: text(2000).refine(validImage, "图片须为 /assets/ 路径或 HTTPS 链接"),
    previewUrl: z.string().trim().max(2000).refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
      } catch { return false; }
    }, "在线体验地址须为完整的 HTTP 或 HTTPS 链接").default(""),
    description: text(500),
    service: z.enum(SERVICES),
    stack: z.array(text(60)).max(12),
    details: z.array(text(300)).max(12),
    tone: z.enum(["lilac", "peach", "mint"]).default("lilac"),
    isDemo: z.boolean(),
    sortOrder: z.number().int().min(0).max(10000),
    published: z.boolean(),
  })
  .strip();

export const settingsSchema = z
  .object({
    studioName: text(80),
    tagline: text(160),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    wechat: z.string().trim().max(120),
    about: text(1500),
  })
  .strict();

export function parseBody(schema, body, res) {
  const result = schema.safeParse(body);
  if (!result.success) {
    res
      .status(400)
      .json({
        error: "提交内容不完整或格式不正确，请检查后重试。",
        issues: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    return null;
  }
  return result.data;
}
