export type EntityField = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea";
  placeholder?: string;
  hint?: string;
  required?: boolean;
};

export type EntityConfig = {
  title: string;
  singular: string;
  description: string;
  fields: EntityField[];
};

export const ENTITIES = {
  fornecedores: {
    title: "Fornecedores",
    singular: "fornecedor",
    description: "Quem vende para você na China.",
    fields: [
      { key: "name", label: "Nome", required: true },
      { key: "contact", label: "Contato (WeChat, WhatsApp...)" },
      { key: "notes", label: "Observações", type: "textarea" },
    ],
  },
  produtos: {
    title: "Produtos",
    singular: "produto",
    description: "Também podem ser criados direto no pedido, digitando um nome novo.",
    fields: [
      { key: "name", label: "Nome", required: true, placeholder: "Camisa Grêmio Third III 26/27" },
      { key: "notes", label: "Observações", type: "textarea" },
    ],
  },
  modalidades: {
    title: "Modalidades de transporte",
    singular: "modalidade",
    description: "Ex.: Aéreo, Aéreo expresso, Marítimo. O prazo sugere a previsão de chegada.",
    fields: [
      { key: "name", label: "Nome", required: true },
      { key: "defaultDays", label: "Prazo médio (dias)", type: "number" },
    ],
  },
  transportadoras: {
    title: "Transportadoras",
    singular: "transportadora",
    description: "Ex.: Correios - Sedex, Fedex, DHL, Nova Mod.",
    fields: [
      { key: "name", label: "Nome", required: true },
      {
        key: "trackingUrl",
        label: "Link de rastreio (opcional)",
        placeholder: "https://site.com/rastreio?codigo={code}",
        hint: "Use {code} no lugar do código. Em branco, usa o 17track.",
      },
    ],
  },
  "formas-pagamento": {
    title: "Formas de pagamento",
    singular: "forma de pagamento",
    description: "Ex.: PIX, transferência internacional, Alipay, Wise.",
    fields: [{ key: "name", label: "Nome", required: true }],
  },
} satisfies Record<string, EntityConfig>;

export type EntitySlug = keyof typeof ENTITIES;

export function isEntitySlug(s: string): s is EntitySlug {
  return s in ENTITIES;
}
