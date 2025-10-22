import React, { useEffect, useMemo, useRef, useState } from "react";

/********************
 * Utils
 ********************/
const brl = (n) => {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const pct = (n) => {
  const val = Number(n ?? 0);
  return (isFinite(val) ? val : 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
};

const currencyToNumber = (s) => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const clean = s.toString().replace(/[R$\s\.]/g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const calcularTIR = (fluxos, chute = 0.1) => {
  let taxa = chute;
  let iteracoes = 0;
  const maxIteracoes = 1000;
  const precisao = 0.0001;

  while (iteracoes < maxIteracoes) {
    let vpl = 0;
    let derivada = 0;

    fluxos.forEach((fluxo, i) => {
      vpl += fluxo / Math.pow(1 + taxa, i);
      derivada -= (i * fluxo) / Math.pow(1 + taxa, i + 1);
    });

    if (Math.abs(vpl) < precisao) break;
    if (derivada === 0) break;

    taxa = taxa - vpl / derivada;
    iteracoes++;
  }

  return iteracoes < maxIteracoes ? taxa * 100 : 0;
};

// Logo padrão (mantemos SVG estável)
const ALVO_LOGO = "data:image/svg+xml,%3Csvg width='1200' height='400' viewBox='0 0 1200 400' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50' y='300' font-family='Arial' font-size='280' font-weight='900' fill='%233A3A3A' letter-spacing='-10'%3EALVO%3C/text%3E%3Ccircle cx='950' cy='200' r='140' stroke='%233A3A3A' stroke-width='28' fill='none'/%3E%3Ccircle cx='950' cy='200' r='85' stroke='%233A3A3A' stroke-width='20' fill='none'/%3E%3Ctext x='1050' y='235' font-family='Arial' font-size='95' font-weight='700' fill='%2334747E'%3EBR%3C/text%3E%3C/svg%3E";

function AlvoLogo({ size = 48 }) {
  return <img src={ALVO_LOGO} alt="Alvo BR" style={{ height: size + 'px', width: 'auto' }} />;
}

/********************
 * PDF helpers
 ********************/
async function ensurePdfLibs() {
  const needH2C = typeof window !== 'undefined' && !window.html2canvas;
  const needJSPDF = typeof window !== 'undefined' && !(window.jspdf && window.jspdf.jsPDF);
  const loaders = [];
  if (needH2C) loaders.push(loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"));
  if (needJSPDF) loaders.push(loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"));
  if (loaders.length) await Promise.all(loaders);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar ' + src));
    document.head.appendChild(s);
  });
}

/********************
 * Sample / defaults
 ********************/
const sample = {
  company: "Alvo BR Imobiliária",
  date: new Date().toISOString().slice(0, 10),
  consultor: "Nome do Consultor",
  phone: "(47) 9 9999-9999",
  email: "contato@alvobr.com.br",
  siteUrl: "https://alvobr.com.br",
  cliente: "Nome do Cliente",
  clientePhone: "(47) 9 8888-8888",
  clienteEmail: "cliente@email.com",
  empreendimento: "Nome do Empreendimento",
  endereco: "Endereço completo — Itajaí/SC",
  construtora: "Nome da Construtora",
  tipo: "Apartamento 2 suítes",
  area: 74,
  entrega: "Dezembro/2026",
  valorTotal: 980000,
  // fluxo (presets + editor)
  splitPreset: "10-45-45",
  entradaValor: 98000,
  entradaPercent: 10,
  duranteObraPercent: 45,
  duranteObraParcelas: 36,
  chavesPercent: 45,
  chavesForma: 'financiamento', // 'financiamento' | 'avista' | 'posConstrutora'
  chavesPosParcelas: 0,
  // balões adicionais
  baloes: [], // {mes: number, valor: number}
  // projeções
  apreciacao: 18,
  prazoEntrega: 3,
  // short stay
  adrDiaria: 350,
  ocupacao: 70,
  custosOperacionais: 30,
  prazoShortStay: 5,
  // validade
  validade: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
};

/********************
 * Main component
 ********************/
export default function AlvoPropostasV2() {
  const [data, setData] = useState(sample);
  const previewRef = useRef(null);

  // sincroniza % e valores pelo preset escolhido
  useEffect(() => {
    if (!data.splitPreset) return;
    if (data.splitPreset === 'custom') return; // não sobrescreve no modo custom
    const [e, o, c] = data.splitPreset.split('-').map(Number);
    setData((d) => ({
      ...d,
      entradaPercent: e,
      duranteObraPercent: o,
      chavesPercent: c,
      entradaValor: d.valorTotal ? (d.valorTotal * e) / 100 : d.entradaValor,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.splitPreset]);

  const valores = useMemo(() => {
    const total = Number(data.valorTotal || 0);
    const entradaValor = Number(data.entradaValor || 0) || (total * Number(data.entradaPercent || 0) / 100);
    const entradaPercent = total > 0 ? (entradaValor / total) * 100 : 0;
    const duranteObraTotal = total * Number(data.duranteObraPercent || 0) / 100;
    const duranteObraParcela = data.duranteObraParcelas ? (duranteObraTotal / Number(data.duranteObraParcelas)) : 0;
    const chavesTotal = total * Number(data.chavesPercent || 0) / 100;

    const chavesFinanciado = data.chavesForma === 'financiamento';
    const valorInvestidoReal = chavesFinanciado
      ? entradaValor + duranteObraTotal
      : entradaValor + duranteObraTotal + chavesTotal;

    // cronograma com balões
    const hoje = new Date();
    const schedule = [];
    if (entradaValor > 0) schedule.push({ tipo: 'Entrada', data: hoje, valor: entradaValor, mes: 0 });
    const n = Number(data.duranteObraParcelas || 0);
    for (let i = 1; i <= n; i++) {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() + i);
      schedule.push({ tipo: `Obra ${i}/${n}`, data: d, valor: duranteObraParcela, mes: i });
    }
    if (data.chavesForma === 'avista' && chavesTotal > 0) {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() + n + 1);
      schedule.push({ tipo: 'Chaves (à vista)', data: d, valor: chavesTotal, mes: n + 1 });
    }
    if (data.chavesForma === 'posConstrutora' && chavesTotal > 0) {
      const parcelas = Number(data.chavesPosParcelas || 0);
      for (let i = 1; i <= parcelas; i++) {
        const d = new Date(hoje);
        d.setMonth(d.getMonth() + n + i);
        schedule.push({ tipo: `Pós-chaves ${i}/${parcelas}`, data: d, valor: chavesTotal / Math.max(parcelas, 1), mes: n + i });
      }
    }
    // Balões adicionais
    (data.baloes || []).forEach((b, idx) => {
      const mes = Math.max(0, Number(b.mes || 0));
      const valor = Number(b.valor || 0);
      if (valor > 0) {
        const d = new Date(hoje);
        d.setMonth(d.getMonth() + mes);
        schedule.push({ tipo: `Balão ${idx + 1}`, data: d, valor, mes });
      }
    });

    // ordenar por mês
    schedule.sort((a,b)=>a.mes-b.mes);

    return { total, entradaValor, entradaPercent, duranteObraTotal, duranteObraParcela, chavesTotal, valorInvestidoReal, schedule };
  }, [data]);

  // helper para montar vetor de fluxos por mês (negativos = saídas)
  const makeFluxos = (lastMonth) => {
    const arr = new Array(lastMonth + 1).fill(0);
    valores.schedule.forEach(s => { arr[s.mes] = (arr[s.mes] || 0) - s.valor; });
    return arr;
  };
