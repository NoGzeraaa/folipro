import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const digits = (v: string) => v.replace(/\D/g, "");

const checkoutSchema = z.object({
  customer: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    phone: z.string().min(10),
    cpf: z.string().min(11),
  }),
  shipping: z.object({
    zipCode: z.string().min(8),
    street: z.string().min(2),
    number: z.string().min(1),
    complement: z.string().optional().default(""),
    neighborhood: z.string().min(2),
    city: z.string().min(2),
    state: z.string().min(2).max(2),
  }),
  card: z.object({
    number: z.string().min(13),
    holderName: z.string().min(3),
    expiryMonth: z.string().length(2),
    expiryYear: z.string().length(4),
    cvv: z.string().min(3).max(4),
    installments: z.number().int().min(1).max(12),
  }),
  device: z
    .object({
      http_browser_language: z.string().optional(),
      http_browser_color_depth: z.number().optional(),
      http_browser_screen_height: z.number().optional(),
      http_browser_screen_width: z.number().optional(),
      http_browser_time_difference: z.number().optional(),
      http_browser_java_enabled: z.boolean().optional(),
      http_browser_javascript_enabled: z.boolean().optional(),
      user_agent: z.string().optional(),
    })
    .optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export type CheckoutResult = {
  status: "PAID" | "PENDING_3DS" | "FAILED" | "PENDING" | string;
  transactionId?: string;
  acsUrl?: string;
  message?: string;
};

export const PRODUCT = {
  title: "Kit Folipro - 4 Produtos",
  amount: 9890, // R$ 98,90 em centavos
};

export const createSale = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const apiKey = process.env["BLACKCAT_API_KEY"] || process.env["STRIPE_LIVE_API_KEY"];
    if (!apiKey) {
      return { status: "FAILED", message: "Gateway de pagamento não configurado." };
    }

    const body = {
      amount: PRODUCT.amount,
      currency: "BRL",
      paymentMethod: "credit_card",
      items: [
        {
          title: PRODUCT.title,
          unitPrice: PRODUCT.amount,
          quantity: 1,
          tangible: true,
        },
      ],
      customer: {
        name: data.customer.name,
        email: data.customer.email,
        phone: digits(data.customer.phone),
        document: { type: "cpf", number: digits(data.customer.cpf) },
      },
      shipping: {
        name: data.customer.name,
        street: data.shipping.street,
        number: data.shipping.number,
        complement: data.shipping.complement || "",
        neighborhood: data.shipping.neighborhood,
        city: data.shipping.city,
        state: data.shipping.state.toUpperCase(),
        zipCode: digits(data.shipping.zipCode),
      },
      card: {
        number: digits(data.card.number),
        holderName: data.card.holderName,
        expiryMonth: data.card.expiryMonth,
        expiryYear: data.card.expiryYear,
        cvv: data.card.cvv,
        installments: data.card.installments,
      },
      device: data.device ?? {},
      postbackUrl: process.env["BLACKCAT_POSTBACK_URL"],
    };

    let json: any;
    try {
      const res = await fetch("https://api.blackcatoficial.com/api/sales/create-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(body),
      });
      json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          status: "FAILED",
          message: json?.message || json?.error || `Falha no pagamento (${res.status}).`,
        };
      }
    } catch {
      return { status: "FAILED", message: "Não foi possível contatar o gateway de pagamento." };
    }

    const d = json?.data ?? json;
    const status: string = d?.status ?? "FAILED";

    if (status === "PENDING_3DS") {
      return {
        status,
        transactionId: d?.transactionId,
        acsUrl: d?.threeDS?.start?.acsUrl,
      };
    }

    if (status === "PAID" || status === "PENDING" || status === "AUTHORIZED") {
      return { status, transactionId: d?.transactionId };
    }

    return {
      status: "FAILED",
      transactionId: d?.transactionId,
      message:
        d?.refusedReason?.description ||
        json?.message ||
        "Pagamento recusado pela operadora do cartão.",
    };
  });
