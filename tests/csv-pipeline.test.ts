import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { emptyWorkspace, type Workspace } from "@/domain/model";
import {
  readCsv,
  previewCsv,
  parseAmount,
  parseCsvDate,
  decodeCsvBytes,
  suggestMapping,
  csvProfile,
  prepareCsvImport,
} from "@/domain/imports";
import { transactionKind } from "@/domain/transactions";
const fixture = readFileSync(
  new URL("./fixtures/inter-account.csv", import.meta.url),
  "utf8",
);
const batch = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "extrato.csv",
  hash: "test",
};
const parse = (text: string) => {
  const file = readCsv(text);
  const mapping = csvProfile(file.fields).mapping;
  return {
    file,
    mapping,
    preview: previewCsv(file, mapping, emptyWorkspace(), batch.id),
  };
};

describe("leitura estrutural do extrato", () => {
  it("encontra cabeçalho após preâmbulo sem importar dados do titular", () => {
    const { file, mapping, preview } = parse(fixture);
    expect(file.headerLine).toBe(5);
    expect(file.preambleLines).toBe(4);
    expect(mapping.description).toBe("Descrição");
    expect(mapping.details).toBe("Histórico");
    expect(mapping.amount).toBe("Valor (R$)");
    expect(file.footerRows).toBe(1);
    expect(preview.rows).toHaveLength(7);
    expect(preview.invalid).toBe(1);
    expect(preview.ignored).toBe(2);
    expect(preview.entries.find((e) => e.status === "invalid")?.line).toBe(15);
    expect(preview.rows[0].description).toBe("GITHUB INC · Compra no débito");
    expect(preview.rows.some((r) => r.description.includes("PESSOA"))).toBe(
      false,
    );
    expect(preview.totals).toEqual([
      { currency: "BRL", debit: "110.2", credit: "1264.46" },
    ]);
    expect(preview.rows[3].kind).toBe("income");
    expect(preview.rows[4].kind).toBe("refund");
  });
  it.each(["\n", "\r\n", "\r"])(
    "preserva linhas com quebra %j, BOM e separador explícito",
    (newline) => {
      const text =
        '\uFEFFsep=;\nResumo sintético\n\nData;Descrição;Valor\n01/10/2026;"Compra; com vírgula,\nsegunda linha";-1,50\n\n02/10/2026;Outra;-2,50'.replaceAll(
          "\n",
          newline,
        );
      const { file, preview } = parse(text);
      expect(file.headerLine).toBe(4);
      expect(file.rows.map((r) => r.line)).toEqual([5, 8]);
      expect(preview.rows).toHaveLength(2);
      expect(preview.rows[0].description).toContain("Compra; com vírgula,");
    },
  );
  it.each([",", ";", "\t", "|"])(
    "suporta separador %j sem float",
    (delimiter) => {
      const { preview } = parse(
        ["date", "description", "amount"].join(delimiter) +
          "\n" +
          ["2026-10-01", '"Serviço, com; pontuação"', "-19.99"].join(delimiter),
      );
      expect(preview.rows[0].amount).toBe("19.99");
      expect(preview.invalid).toBe(0);
    },
  );
  it("não converte coluna deslocada em valor financeiro", () => {
    const { preview } = parse(
      "date,description,amount\n2026-10-01,Good,-20\n2026-10-02,Broken,12,34\n2026-10-03,Short",
    );
    expect(preview.rows).toHaveLength(1);
    expect(preview.invalid).toBe(2);
    expect(preview.entries[1].message).toContain("encontradas 4");
  });
  it("aspas quebradas bloqueiam o lote inteiro, inclusive importar válidas", () => {
    const { file, mapping, preview } = parse(
      'date,description,amount\n2026-10-01,Good,-20\n2026-10-02,"Broken,-10',
    );
    expect(preview.blocking).toBe(true);
    expect(() =>
      prepareCsvImport(file, mapping, emptyWorkspace(), batch, {
        allowPartial: true,
        excluded: new Set(),
      }),
    ).toThrow("estrutura");
  });
  it("rejeita colunas duplicadas em vez de perder o valor original", () => {
    expect(() =>
      readCsv("Data;Descrição;Valor;Valor\n01/10/2026;Teste;-10;-11"),
    ).toThrow("repetidos");
  });
  it("deixa colunas desconhecidas disponíveis para mapeamento manual", () => {
    const file = readCsv("Quando;Onde;Quanto\n01/10/2026;Teste;-10");
    expect(file.fields).toEqual(["Quando", "Onde", "Quanto"]);
    expect(() =>
      previewCsv(file, suggestMapping(file.fields), emptyWorkspace(), batch.id),
    ).toThrow("Escolha");
  });
  it("aceita delimitador final vazio, mas não ignora coluna extra preenchida", () => {
    const { preview } = parse(
      "Data;Descrição;Valor;\n01/10/2026;Teste;-10;;\n02/10/2026;Erro;-10;conteúdo",
    );
    expect(preview.rows).toHaveLength(1);
    expect(preview.invalid).toBe(1);
  });
  it("não confunde Saldo como nome de comerciante com um rodapé", () => {
    const { preview } = parse(
      "Data;Descrição;Valor\n01/10/2026;Saldo;-10\nData errada;Compra;-20",
    );
    expect(preview.rows).toHaveLength(1);
    expect(preview.invalid).toBe(1);
  });
  it("processa 20 mil linhas e interrompe acima do limite", () => {
    const text =
      "Data;Descrição;Valor\n" +
      Array.from(
        { length: 20_000 },
        (_, i) => `01/10/2026;Serviço ${i};-1,50`,
      ).join("\n");
    const { preview } = parse(text);
    expect(preview.rows).toHaveLength(20_000);
    expect(preview.totals[0].debit).toBe("30000");
    expect(() => readCsv(text + "\n02/10/2026;Limite;-10")).toThrow("20 mil");
  });
});

describe("codificação de arquivo e valores", () => {
  it("decodifica UTF-8 e Windows-1252 sem estragar acentos", () => {
    expect(decodeCsvBytes(new TextEncoder().encode(fixture)).encoding).toBe(
      "UTF-8",
    );
    const source =
      "Data;Descrição;Valor\r\n01/10/2026;Serviço de edição;-19,90";
    const bytes = Uint8Array.from([...source].map((c) => c.charCodeAt(0)));
    const decoded = decodeCsvBytes(bytes);
    expect(decoded.encoding).toBe("Windows-1252");
    expect(parse(decoded.text).preview.rows[0].description).toBe(
      "Serviço de edição",
    );
  });
  it.each([false, true])("aceita UTF-16 com BOM, big endian: %s", (big) => {
    const source = "Data;Descrição;Valor\n01/10/2026;Serviço;-1,50";
    const bytes = new Uint8Array(2 + source.length * 2);
    bytes.set(big ? [0xfe, 0xff] : [0xff, 0xfe]);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < source.length; i++)
      view.setUint16(2 + i * 2, source.charCodeAt(i), !big);
    expect(parse(decodeCsvBytes(bytes).text).preview.rows[0].amount).toBe(
      "1.5",
    );
  });
  it.each(["%PDF-1.7", "PK\x03\x04", "<!DOCTYPE html>", "abc\0data"])(
    "recusa binário/HTML: %j",
    (source) => {
      expect(() => decodeCsvBytes(new TextEncoder().encode(source))).toThrow(
        "não é um CSV",
      );
    },
  );
  it("rejeita arquivo vazio e maior que 10 MB", () => {
    expect(() => decodeCsvBytes(new Uint8Array())).toThrow("vazio");
    expect(() => decodeCsvBytes(new Uint8Array(10 * 1024 * 1024 + 1))).toThrow(
      "10 MB",
    );
  });
  it.each([
    ["−R$ 1.234,56", "br", "-1234.56"],
    ["(US$ 1,234.56)", "us", "-1234.56"],
    ["+ 12,50", "br", "12.5"],
    ["1.234,56 D", "br", "-1234.56"],
    ["12,50 C", "br", "12.5"],
    ["1.234", "br", "1234"],
    ["1.234", "us", "1.234"],
    ["0.000001", "us", "0.000001"],
  ] as const)("interpreta %s no formato %s", (value, format, expected) =>
    expect(parseAmount(value, format).toFixed()).toBe(expected),
  );
  it.each([
    "1.234",
    "1,234",
    "1,2,3",
    "12.34,56",
    "USD lixo 2",
    "(-10)",
    "-10 D",
    "1e3",
    "NaN",
    "Infinity",
    "10000000000",
    "0.0000001",
  ])("recusa valor ambíguo/inválido %s", (value) =>
    expect(() => parseAmount(value)).toThrow(),
  );
  it.each(["31/04/2026", "29/02/2025", "2026-02-29", "10/11-2026", "01/01/26"])(
    "recusa data impossível/incompleta %s",
    (date) => expect(() => parseCsvDate(date, "dmy")).toThrow(),
  );
  it("aceita bissexto sem conversão de fuso", () =>
    expect(parseCsvDate("29/02/2024", "dmy")).toBe("2024-02-29"));
});

describe("conciliação e preparação do lote", () => {
  it("não atribui BRL a um valor explicitamente em USD", () => {
    const { preview } = parse(
      "date,description,amount\n2026-10-01,Teste,US$ 10.00",
    );
    expect(preview.rows).toHaveLength(0);
    expect(preview.entries[0].message).toContain(
      "moeda escrita no valor difere",
    );
  });
  it("suporta débito e crédito separados, nunca os dois na mesma linha", () => {
    const { preview } = parse(
      "Data;Descrição;Débito;Crédito\n01/10/2026;Compra;10,50;\n02/10/2026;Recebimento;;20,00\n03/10/2026;Conflito;10;20",
    );
    expect(preview.rows.map((t) => [t.direction, t.kind, t.amount])).toEqual([
      ["debit", "expense", "10.5"],
      ["credit", "income", "20"],
    ]);
    expect(preview.invalid).toBe(1);
  });
  it("mantém multiplicidade, concilia sobreposição e detecta ID conflitante", () => {
    const { file, mapping, preview } = parse(
      "date,description,amount,id\n2026-10-01,GitHub,-10,a\n2026-10-01,GitHub,-10,a\n2026-10-02,GitHub,-20,a",
    );
    expect(preview.rows).toHaveLength(1);
    expect(preview.duplicates).toBe(1);
    expect(preview.invalid).toBe(1);
    const w = emptyWorkspace();
    w.transactions = preview.rows;
    expect(previewCsv(file, mapping, w, batch.id).rows).toHaveLength(0);
  });
  it("preserva chaves legadas e comparação decimal exata", () => {
    const { file, mapping, preview } = parse(
      "Data;Descrição;Valor\n01/10/2026;GITHUB;-10,00\n01/10/2026;GITHUB;-10,00",
    );
    const w = emptyWorkspace();
    w.transactions = [{ ...preview.rows[0], amount: "10.000000" }];
    const next = previewCsv(file, mapping, w, batch.id);
    expect(next.rows).toHaveLength(1);
    expect(next.duplicates).toBe(1);
    expect(next.rows[0].sourceKey).toMatch(/\|2$/);
  });
  it("exige aceite parcial e permite completar o mesmo arquivo depois", () => {
    const { file, mapping } = parse(fixture);
    expect(() =>
      prepareCsvImport(file, mapping, emptyWorkspace(), batch, {
        allowPartial: false,
        excluded: new Set(),
      }),
    ).toThrow("autorize");
    const first = prepareCsvImport(file, mapping, emptyWorkspace(), batch, {
      allowPartial: true,
      excluded: new Set([6]),
    });
    expect(first.workspace.transactions).toHaveLength(6);
    const second = prepareCsvImport(
      file,
      mapping,
      first.workspace,
      { ...batch, id: crypto.randomUUID() },
      { allowPartial: true, excluded: new Set() },
    );
    expect(second.workspace.transactions).toHaveLength(7);
    expect(second.preview.rows).toHaveLength(1);
    expect(first.workspace.imports[0].hash).toBe(
      second.workspace.imports[1].hash,
    );
  });
  it("separa moedas sem conversão e não altera workspace na prévia", () => {
    const { file, mapping } = parse(
      "date,description,amount,currency\n2026-10-01,A,-0.1,USD\n2026-10-02,A,-0.2,USD\n2026-10-01,B,-10,BRL",
    );
    const w = emptyWorkspace();
    const before = structuredClone(w);
    const preview = previewCsv(file, mapping, w, batch.id);
    expect(preview.totals).toEqual([
      { currency: "BRL", debit: "10", credit: "0" },
      { currency: "USD", debit: "0.3", credit: "0" },
    ]);
    expect(w).toEqual(before);
  });
  it("rejeita uso repetido da mesma coluna e nome de conta longo", () => {
    const { file, mapping } = parse("date,description,amount\n2026-10-01,A,-1");
    expect(() =>
      previewCsv(
        file,
        { ...mapping, description: mapping.date },
        emptyWorkspace(),
        batch.id,
      ),
    ).toThrow("diferente");
    expect(() =>
      previewCsv(
        file,
        { ...mapping, account: "a".repeat(101) },
        emptyWorkspace(),
        batch.id,
      ),
    ).toThrow("100");
  });
  it("limites do workspace são checados antes da gravação", () => {
    const { file, mapping, preview } = parse(
      "date,description,amount\n2026-10-01,A,-1",
    );
    const w: Workspace = {
      ...emptyWorkspace(),
      transactions: Array(50_000).fill({
        ...preview.rows[0],
        sourceKey: "other",
      }),
    };
    expect(() =>
      prepareCsvImport(file, mapping, w, batch, {
        allowPartial: false,
        excluded: new Set(),
      }),
    ).toThrow("50 mil");
  });
  it("não chama entrada de estorno e separa movimentos não recorrentes", () => {
    expect(transactionKind("Recebimento de cliente", "credit")).toBe("income");
    expect(transactionKind("Estorno GitHub", "credit")).toBe("refund");
    expect(transactionKind("Pix recebido", "credit")).toBe("transfer");
    expect(transactionKind("Pagamento de fatura", "debit")).toBe(
      "invoice_payment",
    );
    expect(transactionKind("Compra 03/12", "debit")).toBe("installment");
  });
});
