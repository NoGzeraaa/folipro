import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/obrigado")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : "",
  }),
  component: Obrigado,
  head: () => ({
    meta: [
      { title: "Pedido confirmado | FOLIPRO" },
      {
        name: "description",
        content: "Recebemos seu pedido do Kit Folipro. Em breve você recebe a confirmação por e-mail.",
      },
      { property: "og:title", content: "Pedido confirmado | FOLIPRO" },
      { property: "og:description", content: "Recebemos seu pedido do Kit Folipro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Obrigado() {
  const { id } = useSearch({ from: "/obrigado" });
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-md rounded-xl border border-primary/30 bg-card p-8 text-center">
        <span className="text-sm font-semibold tracking-[0.35em] text-primary">FOLIPRO</span>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Pagamento aprovado!</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Obrigado pela sua compra do Kit Folipro – 4 Produtos. Você receberá a confirmação e o
          código de rastreio por e-mail.
        </p>
        {id ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Código do pedido: <span className="text-primary">{id}</span>
          </p>
        ) : null}
        <Button asChild className="mt-8 w-full">
          <Link to="/">Voltar</Link>
        </Button>
      </div>
    </div>
  );
}
