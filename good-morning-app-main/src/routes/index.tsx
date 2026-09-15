import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { createSale } from "@/lib/blackcat.functions";

export const Route = createFileRoute("/")({
  component: Checkout,
  head: () => ({
    meta: [
      { title: "Checkout Kit Folipro – 4 Produtos | FOLIPRO" },
      {
        name: "description",
        content:
          "Finalize sua compra do Kit Folipro: 3x Sérum Corporal + 1x Esfoliante Corporal 200g. Pagamento seguro no cartão de crédito.",
      },
      { property: "og:title", content: "Checkout Kit Folipro – 4 Produtos | FOLIPRO" },
      {
        property: "og:description",
        content:
          "3x Folipro Sérum Corporal + 1x Esfoliante Corporal 200g. Pagamento no cartão de crédito em até 12x.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const PRICE = 98.9;
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const onlyDigits = (v: string) => v.replace(/\D/g, "");

function maskCard(v: string) {
  return onlyDigits(v).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function maskExpiry(v: string) {
  const d = onlyDigits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
function maskCpf(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
function maskCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <Input id={id} {...props} className="h-11 bg-secondary/60 border-border" />
    </div>
  );
}

const initialForm = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  cardNumber: "",
  cardName: "",
  expiry: "",
  cvv: "",
  installments: "1",
};

function Checkout() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const pay = useServerFn(createSale);

  const set = (k: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [k]: value }));

  const installmentOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        return { n, label: `${n}x de ${brl(PRICE / n)}${n === 1 ? " à vista" : " sem juros"}` };
      }),
    [],
  );

  const lookupCep = async (value: string) => {
    const d = onlyDigits(value);
    if (d.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json();
      if (data?.erro) return;
      setForm((f) => ({
        ...f,
        street: data.logradouro || f.street,
        neighborhood: data.bairro || f.neighborhood,
        city: data.localidade || f.city,
        state: data.uf || f.state,
      }));
    } catch {
      /* preenchimento manual */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onlyDigits(form.cardNumber).length < 13) return toast.error("Número do cartão inválido.");
    if (onlyDigits(form.expiry).length < 4) return toast.error("Validade inválida.");
    if (form.cvv.length < 3) return toast.error("CVV inválido.");
    if (onlyDigits(form.cpf).length !== 11) return toast.error("CPF inválido.");

    const [mm, yy] = form.expiry.split("/");

    setLoading(true);
    try {
      const result = await pay({
        data: {
          customer: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: onlyDigits(form.phone),
            cpf: onlyDigits(form.cpf),
          },
          shipping: {
            zipCode: onlyDigits(form.zipCode),
            street: form.street.trim(),
            number: form.number.trim(),
            complement: form.complement.trim(),
            neighborhood: form.neighborhood.trim(),
            city: form.city.trim(),
            state: form.state.trim().toUpperCase(),
          },
          card: {
            number: onlyDigits(form.cardNumber),
            holderName: form.cardName.trim(),
            expiryMonth: mm ?? "",
            expiryYear: `20${yy ?? ""}`,
            cvv: form.cvv,
            installments: Number(form.installments),
          },
          device: {
            http_browser_language: navigator.language,
            http_browser_color_depth: window.screen.colorDepth,
            http_browser_screen_height: window.screen.height,
            http_browser_screen_width: window.screen.width,
            http_browser_time_difference: -new Date().getTimezoneOffset(),
            http_browser_java_enabled: false,
            http_browser_javascript_enabled: true,
            user_agent: navigator.userAgent,
          },
        },
      });

      if (result.status === "PENDING_3DS" && result.acsUrl) {
        toast.info("Redirecionando para a autenticação do seu banco...");
        window.location.href = result.acsUrl;
        return;
      }
      if (result.status === "PAID" || result.status === "AUTHORIZED") {
        navigate({ to: "/obrigado", search: { id: result.transactionId ?? "" } });
        return;
      }
      if (result.status === "PENDING") {
        toast.info("Pagamento em processamento. Avisaremos por e-mail assim que for aprovado.");
        return;
      }
      toast.error(result.message ?? "Não foi possível concluir o pagamento.");
    } catch {
      toast.error("Erro ao processar o pagamento. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <span className="text-xl font-semibold tracking-[0.35em] text-primary">FOLIPRO</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Pagamento seguro
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-5 py-10 lg:grid-cols-[1.25fr_1fr]">
        <section>
          <h1 className="text-2xl font-semibold">Finalizar compra</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pagamento exclusivo no cartão de crédito.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-5 text-sm font-medium uppercase tracking-widest text-primary">
                Seus dados
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    id="name"
                    label="Nome completo"
                    value={form.name}
                    onChange={(e) => set("name")(e.target.value)}
                    required
                  />
                </div>
                <Field
                  id="email"
                  label="E-mail"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  required
                />
                <Field
                  id="phone"
                  label="Telefone"
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  value={form.phone}
                  onChange={(e) => set("phone")(maskPhone(e.target.value))}
                  required
                />
                <Field
                  id="cpf"
                  label="CPF"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => set("cpf")(maskCpf(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-5 text-sm font-medium uppercase tracking-widest text-primary">
                Endereço de entrega
              </h2>
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Field
                    id="zipCode"
                    label="CEP"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={form.zipCode}
                    onChange={(e) => {
                      const v = maskCep(e.target.value);
                      set("zipCode")(v);
                      void lookupCep(v);
                    }}
                    required
                  />
                </div>
                <div className="sm:col-span-4">
                  <Field
                    id="street"
                    label="Rua"
                    value={form.street}
                    onChange={(e) => set("street")(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Field
                    id="number"
                    label="Número"
                    value={form.number}
                    onChange={(e) => set("number")(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-4">
                  <Field
                    id="complement"
                    label="Complemento (opcional)"
                    value={form.complement}
                    onChange={(e) => set("complement")(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Field
                    id="neighborhood"
                    label="Bairro"
                    value={form.neighborhood}
                    onChange={(e) => set("neighborhood")(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Field
                    id="city"
                    label="Cidade"
                    value={form.city}
                    onChange={(e) => set("city")(e.target.value)}
                    required
                  />
                </div>
                <div className="sm:col-span-1">
                  <Field
                    id="state"
                    label="UF"
                    maxLength={2}
                    value={form.state}
                    onChange={(e) => set("state")(e.target.value.toUpperCase().slice(0, 2))}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="mb-5 text-sm font-medium uppercase tracking-widest text-primary">
                Cartão de crédito
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    id="cardNumber"
                    label="Número do cartão"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    value={form.cardNumber}
                    onChange={(e) => set("cardNumber")(maskCard(e.target.value))}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Field
                    id="cardName"
                    label="Nome impresso no cartão"
                    autoComplete="cc-name"
                    value={form.cardName}
                    onChange={(e) => set("cardName")(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <Field
                  id="expiry"
                  label="Validade"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/AA"
                  value={form.expiry}
                  onChange={(e) => set("expiry")(maskExpiry(e.target.value))}
                  required
                />
                <Field
                  id="cvv"
                  label="CVV"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="000"
                  value={form.cvv}
                  onChange={(e) => set("cvv")(onlyDigits(e.target.value).slice(0, 4))}
                  required
                />
                <div className="space-y-2 sm:col-span-2">
                  <Label
                    htmlFor="installments"
                    className="text-xs uppercase tracking-widest text-muted-foreground"
                  >
                    Parcelas
                  </Label>
                  <select
                    id="installments"
                    value={form.installments}
                    onChange={(e) => set("installments")(e.target.value)}
                    className="h-11 w-full rounded-md border border-border bg-secondary/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {installmentOptions.map((o) => (
                      <option key={o.n} value={String(o.n)} className="bg-card">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full text-sm font-semibold uppercase tracking-widest"
            >
              {loading ? "Processando..." : `Pagar ${brl(PRICE)}`}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Ambiente protegido. Seus dados são usados apenas para processar este pedido.
            </p>
          </form>
        </section>

        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="rounded-xl border border-primary/30 bg-card p-6">
            <h2 className="text-sm font-medium uppercase tracking-widest text-primary">
              Resumo do pedido
            </h2>
            <div className="mt-5">
              <h3 className="text-lg font-semibold">Kit Folipro – 4 Produtos</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                3x Folipro Sérum Corporal + 1x Esfoliante Corporal 200g. Um kit completo para
                complementar sua rotina de cuidados corporais, proporcionando limpeza, hidratação e
                cuidado com a pele.
              </p>
            </div>
            <Separator className="my-6 bg-border" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{brl(PRICE)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span className="text-primary">Grátis</span>
              </div>
            </div>
            <Separator className="my-6 bg-border" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm uppercase tracking-widest text-muted-foreground">Total</span>
              <span className="text-2xl font-semibold text-primary">{brl(PRICE)}</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
