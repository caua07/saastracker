import Papa from "papaparse";
import type { Workspace } from "../model";

export function subscriptionsCsv(workspace: Workspace): string {
  const safe = (v: string) => (/^[=+@\-\t\r]/.test(v) ? `'${v}` : v);
  return Papa.unparse(
    {
      fields: [
        "Serviço",
        "Valor",
        "Moeda",
        "Ciclo",
        "Categoria",
        "Status",
        "Próxima referência",
      ],
      data: workspace.subscriptions.map((s) => [
        safe(s.name),
        s.amount,
        s.currency,
        s.cycle,
        safe(s.category),
        s.status,
        s.anchorDate,
      ]),
    },
    { delimiter: ";" },
  );
}
