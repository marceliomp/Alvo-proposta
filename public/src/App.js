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
  // presets/fluxo
  splitPreset: "10-45-45",
  entradaValor: 98000,
  entradaPercent: 10,
  duranteObraPercent: 45,
  duranteObraParcelas: 36,
  chavesPercent: 45,
  chavesForma: 'financiamento', // 'financiamento' | 'avista' | 'posConstrutora'
  chavesPosParcelas: 0,
  // balões pós-chaves
  balaoValor: 0,
  balaoQuantidade: 0,
  balaoFrequenciaMeses: 6,
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
    if (!data.splitPreset || data.splitPreset === 'custom') return;
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

    // cronograma
    const hoje = new Date();
    const schedule = [];
    if (entradaValor > 0) schedule.push({ tipo: 'Entrada', data: hoje, valor: entradaValor });
    const n = Number(data.duranteObraParcelas || 0);
    for (let i = 1; i <= n; i++) {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() + i);
      schedule.push({ tipo: `Obra ${i}/${n}`, data: d, valor: duranteObraParcela });
    }
    if (data.chavesForma === 'avista' && chavesTotal > 0) {
      const d = new Date(hoje);
      d.setMonth(d.getMonth() + n + 1);
      schedule.push({ tipo: 'Chaves (à vista)', data: d, valor: chavesTotal });
    }
    if (data.chavesForma === 'posConstrutora' && chavesTotal > 0) {
      const parcelas = Number(data.chavesPosParcelas || 0);
      for (let i = 1; i <= parcelas; i++) {
        const d = new Date(hoje);
        d.setMonth(d.getMonth() + n + i);
        schedule.push({ tipo: `Pós-chaves ${i}/${parcelas}`, data: d, valor: chavesTotal / Math.max(parcelas, 1) });
      }
    }
    // Balões pós-chaves (após chaves ou pós-chaves com construtora)
    const q = Math.max(0, Number(data.balaoQuantidade || 0));
    const vBalao = Math.max(0, Number(data.balaoValor || 0));
    const freq = Math.max(1, Number(data.balaoFrequenciaMeses || 1));
    if (q > 0 && vBalao > 0) {
      let startOffset = n + 1; // default: logo após chaves
      if (data.chavesForma === 'posConstrutora') {
        startOffset = n + Number(data.chavesPosParcelas || 0) + 1;
      }
      for (let i = 0; i < q; i++) {
        const d = new Date(hoje);
        d.setMonth(d.getMonth() + startOffset + i * freq);
        schedule.push({ tipo: `Balão ${i + 1}/${q}`, data: d, valor: vBalao });
      }
    }

    return { total, entradaValor, entradaPercent, duranteObraTotal, duranteObraParcela, chavesTotal, valorInvestidoReal, schedule };
  }, [data]);

  // Fluxos auxiliares: retorna array de fluxos mensais considerando obra, chaves e balões
  const buildFluxosBase = (incluirChaves = true) => {
    const fluxos = [];
    // entrada
    fluxos.push(-valores.entradaValor);
    // obra mensal
    const mesesObra = Number(data.duranteObraParcelas || 36);
    for (let i = 0; i < mesesObra; i++) fluxos.push(-valores.duranteObraParcela);
    // chaves
    if (incluirChaves) {
      if (data.chavesForma === 'avista') fluxos.push(-valores.chavesTotal);
      else if (data.chavesForma === 'posConstrutora') {
        const parcelas = Number(data.chavesPosParcelas || 0);
        for (let i = 0; i < parcelas; i++) fluxos.push(-(valores.chavesTotal / Math.max(parcelas, 1)));
      } else {
        // financiamento: não entra no investido real; mantemos carência de 12 meses zerados
        for (let i = 0; i < 12; i++) fluxos.push(0);
      }
    }
    // balões (pós-chaves)
    const q = Math.max(0, Number(data.balaoQuantidade || 0));
    const vBalao = Math.max(0, Number(data.balaoValor || 0));
    const freq = Math.max(1, Number(data.balaoFrequenciaMeses || 1));
    if (q > 0 && vBalao > 0) {
      let startAfter = mesesObra + 1;
      if (data.chavesForma === 'posConstrutora') startAfter = mesesObra + Number(data.chavesPosParcelas || 0) + 1;
      for (let i = 0; i < q; i++) {
        // preencher zeros até a posição do balão se necessário
        const targetIndex = startAfter + i * freq;
        while (fluxos.length < targetIndex) fluxos.push(0);
        fluxos.push(-vBalao);
      }
    }
    return fluxos;
  };

  const cenario1 = useMemo(() => {
    const anos = Number(data.prazoEntrega || 3);
    const taxaValorizacao = Number(data.apreciacao || 0) / 100;
    const valorFinal = valores.total * Math.pow(1 + taxaValorizacao, anos);
    const lucro = valorFinal - valores.total;
    const roi = (lucro / valores.total) * 100;
    const roas = (lucro / valores.valorInvestidoReal) * 100;

    const fluxos = buildFluxosBase(true);
    fluxos.push(valorFinal);

    const tir = calcularTIR(fluxos);
    const tirAnual = ((Math.pow(1 + tir / 100, 12) - 1) * 100);

    return { valorFinal, lucro, roi, roas, tir: tirAnual, prazo: anos };
  }, [valores, data]);

  const cenario2 = useMemo(() => {
    const anosEntrega = Number(data.prazoEntrega || 3);
    const taxaValorizacao = Number(data.apreciacao || 0) / 100;
    const valorFinal = valores.total * Math.pow(1 + taxaValorizacao, anosEntrega);
    const patrimonioAcrescido = valorFinal - valores.total;
    const adrDiaria = Number(data.adrDiaria || 0);
    const ocupacaoPercent = Number(data.ocupacao || 0) / 100;
    const custosPercent = Number(data.custosOperacionais || 0) / 100;
    const receitaMensalBruta = adrDiaria * ocupacaoPercent * 30;
    const aluguelLiquido = receitaMensalBruta * (1 - custosPercent);
    const mesesOperacao = Number(data.prazoShortStay || 5) * 12;
    const rendaAcumulada = aluguelLiquido * mesesOperacao;
    const retornoTotal = patrimonioAcrescido + rendaAcumulada;
    const roi = (retornoTotal / valores.total) * 100;
    const roas = (retornoTotal / valores.valorInvestidoReal) * 100;

    const fluxos = buildFluxosBase(true);
    for (let i = 0; i < mesesOperacao; i++) fluxos.push(aluguelLiquido);
    fluxos.push(valorFinal);

    const tir = calcularTIR(fluxos);
    const tirAnual = ((Math.pow(1 + tir / 100, 12) - 1) * 100);

    return { valorFinal, patrimonioAcrescido, adrDiaria, receitaMensalBruta, aluguelLiquido, aluguelAnual: aluguelLiquido * 12, rendaAcumulada, retornoTotal, roi, roas, tir: tirAnual, prazoTotal: anosEntrega + Number(data.prazoShortStay || 5) };
  }, [valores, data]);

  const handle = (k) => (e) => setData((d) => ({ ...d, [k]: e.target.value }));
  const handleNumeric = (k) => (e) => setData((d) => ({ ...d, [k]: currencyToNumber(e.target.value) }));
  const handlePercent = (k) => (e) => {
    const num = parseFloat((e.target.value + "").replace(",", "."));
    setData((d) => ({ ...d, [k]: isNaN(num) ? 0 : num }));
  };
  const fillExample = () => setData(sample);
  const clearAll = () => setData({});

  const savePDF = async () => {
    try {
      await ensurePdfLibs();
      const node = previewRef.current;
      if (!node) return;

      node.style.background = '#ffffff';
      const canvas = await window.html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = canvas.height * (imgWidth / canvas.width);

      let position = 0;
      let heightLeft = imgHeight;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const fileName = `Proposta_Alvo_${(data.cliente||'cliente').replace(/\s+/g,'_')}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      alert('Não foi possível gerar o PDF. Use o botão Imprimir do navegador como alternativa.\n' + err.message);
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3">
          <AlvoLogo size={32} />
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-lg font-semibold">Alvo Propostas</h1>
            <p className="text-xs text-gray-500">ROI • ROAS • TIR • Cronograma de Pagamento</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fillExample} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm">Exemplo</button>
            <button onClick={clearAll} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm">Limpar</button>
            <button onClick={savePDF} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">Baixar PDF</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-5 gap-6 p-4">
        {/* left column */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Empresa">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Empresa" value={data.company || ""} onChange={handle("company")} />
              <Input label="Data" value={data.date || ""} onChange={handle("date")} />
              <Input label="Consultor" value={data.consultor || ""} onChange={handle("consultor")} />
              <Input label="Telefone" value={data.phone || ""} onChange={handle("phone")} />
              <Input label="E-mail" value={data.email || ""} onChange={handle("email")} />
              <Input label="Site (URL)" value={data.siteUrl || ""} onChange={handle("siteUrl")} placeholder="https://alvobr.com.br" />
            </div>
          </Card>

          <Card title="Cliente">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nome" value={data.cliente || ""} onChange={handle("cliente")} />
              <Input label="Telefone" value={data.clientePhone || ""} onChange={handle("clientePhone")} />
              <div className="col-span-2">
                <Input label="E-mail" value={data.clienteEmail || ""} onChange={handle("clienteEmail")} />
              </div>
            </div>
          </Card>

          <Card title="Empreendimento">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nome" value={data.empreendimento || ""} onChange={handle("empreendimento")} />
              <Input label="Endereço" value={data.endereco || ""} onChange={handle("endereco")} />
              <Input label="Construtora" value={data.construtora || ""} onChange={handle("construtora")} />
              <Input label="Tipo" value={data.tipo || ""} onChange={handle("tipo")} />
              <Input label="Área" value={data.area ?? ""} onChange={handleNumeric("area")} />
              <Input label="Entrega" value={data.entrega || ""} onChange={handle("entrega")} />
            </div>
          </Card>

          <Card title="Fluxo de Pagamento">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Valor total" value={data.valorTotal ?? ""} onChange={handleNumeric("valorTotal")} />
                <select className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.splitPreset}
                        onChange={(e)=>setData(d=>({...d, splitPreset: e.target.value}))}>
                  <option value="10-45-45">Preset 10 / 45 / 45</option>
                  <option value="20-40-40">Preset 20 / 40 / 40</option>
                  <option value="30-40-30">Preset 30 / 40 / 30</option>
                  <option value="custom">Customizar</option>
                </select>
                <Input label="Entrada (R$)" value={data.entradaValor ?? ""} onChange={handleNumeric("entradaValor")} />
                <Input label="Entrada (%)" value={data.entradaPercent ?? ""} onChange={handlePercent("entradaPercent")} />
                <Input label="Obra (%)" value={data.duranteObraPercent ?? ""} onChange={handlePercent("duranteObraPercent")} />
                <Input label="Parcelas de obra" value={data.duranteObraParcelas ?? ""} onChange={handleNumeric("duranteObraParcelas")} />
                <Input label="Chaves (%)" value={data.chavesPercent ?? ""} onChange={handlePercent("chavesPercent")} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <div className="text-xs text-gray-600 mb-1">Forma das chaves</div>
                  <select className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500" value={data.chavesForma}
                    onChange={(e)=>setData(d=>({...d, chavesForma: e.target.value}))}>
                    <option value="financiamento">Financiamento bancário</option>
                    <option value="avista">À vista na entrega</option>
                    <option value="posConstrutora">Parcelado com a construtora (pós-chaves)</option>
                  </select>
                </label>
                {data.chavesForma === 'posConstrutora' && (
                  <Input label="Parcelas pós-chaves" value={data.chavesPosParcelas ?? ''} onChange={handleNumeric('chavesPosParcelas')} />
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input label="Balões (R$)" value={data.balaoValor ?? ''} onChange={handleNumeric('balaoValor')} />
                <Input label="Qtde de balões" value={data.balaoQuantidade ?? ''} onChange={handleNumeric('balaoQuantidade')} />
                <Input label="Frequência (meses)" value={data.balaoFrequenciaMeses ?? ''} onChange={handleNumeric('balaoFrequenciaMeses')} />
              </div>

              <div className="text-xs bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="font-semibold mb-1">Resumo automático</p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <li>Entrada: <strong>{brl(valores.entradaValor)} ({pct(valores.entradaPercent)})</strong></li>
                  <li>Obra: <strong>{brl(valores.duranteObraTotal)}</strong> em <strong>{data.duranteObraParcelas}x</strong> ({brl(valores.duranteObraParcela)}/mês)</li>
                  <li>Chaves: <strong>{brl(valores.chavesTotal)}</strong> {data.chavesForma==='financiamento' ? '(financiado)' : data.chavesForma==='posConstrutora' ? `em ${(data.chavesPosParcelas||0)}x` : ''}</li>
                  {Number(data.balaoQuantidade)>0 && Number(data.balaoValor)>0 && (
                    <li>Balões: <strong>{data.balaoQuantidade}× {brl(data.balaoValor)}</strong> a cada <strong>{data.balaoFrequenciaMeses}</strong> meses</li>
                  )}
                  <li>Investimento real: <strong>{brl(valores.valorInvestidoReal)}</strong></li>
                </ul>
              </div>

              <details className="bg-white border rounded-xl p-3">
                <summary className="cursor-pointer font-medium">Ver cronograma detalhado (datas e valores)</summary>
                <div className="mt-3 max-h-64 overflow-auto text-sm">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2">Parcela</th>
                        <th>Data</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valores.schedule.map((p, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-2">{p.tipo}</td>
                          <td>{p.data.toLocaleDateString('pt-BR')}</td>
                          <td className="font-medium">{brl(p.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          </Card>

          <Card title="Projeções">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valorização anual (%)" value={data.apreciacao ?? ""} onChange={handlePercent("apreciacao")} />
              <Input label="Prazo de obra (anos)" value={data.prazoEntrega ?? ""} onChange={handleNumeric("prazoEntrega")} />
              <Input label="Validade da proposta" value={data.validade || ""} onChange={handle("validade")} />
            </div>
          </Card>

          <Card title="Short Stay (opcional)">
            <div className="grid grid-cols-2 gap-3">
              <Input label="ADR (R$)" value={data.adrDiaria ?? ""} onChange={handleNumeric("adrDiaria")} />
              <Input label="Ocupação (%)" value={data.ocupacao ?? ""} onChange={handlePercent("ocupacao")} />
              <Input label="Custos (%)" value={data.custosOperacionais ?? ""} onChange={handlePercent("custosOperacionais")} />
              <Input label="Prazo (anos)" value={data.prazoShortStay ?? ""} onChange={handleNumeric("prazoShortStay")} />
            </div>
          </Card>
        </div>

        {/* right column */}
        <div className="lg:col-span-3">
          <div ref={previewRef} className="proposta-preview bg-white shadow-sm rounded-2xl overflow-hidden">
            <div className="p-8 border-b">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold">Proposta Comercial</h2>
                  <p className="text-sm text-gray-500 truncate">{data.company}</p>
                  <p className="text-sm text-gray-500">{data.date} · {data.consultor}</p>
                  <p className="text-sm text-gray-500">{data.phone} · {data.email}</p>
                  {data.siteUrl && (
                    <a href={data.siteUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">
                      {data.siteUrl}
                    </a>
                  )}
                </div>
                <AlvoLogo size={50} />
              </div>
            </div>

            <section className="p-8">
              <h3 className="font-semibold text-lg mb-3">1. Apresentação</h3>
              <p className="text-gray-700">
                A <strong>Alvo BR</strong> é especializada em curadoria de investimentos imobiliários,
                unindo dados, método e resultado.
              </p>
            </section>

            <section className="p-8 pt-0">
              <h3 className="font-semibold text-lg mb-2">2. Cliente</h3>
              <div className="space-y-1 text-sm">
                <DataRow k="Nome" v={data.cliente} />
                <DataRow k="Telefone" v={data.clientePhone} />
                <DataRow k="E-mail" v={data.clienteEmail} />
              </div>
            </section>

            <section className="p-8 pt-0">
              <h3 className="font-semibold text-lg mb-2">3. Empreendimento</h3>
              <div className="space-y-1 text-sm">
                <DataRow k="Nome" v={data.empreendimento} />
                <DataRow k="Local" v={data.endereco} />
                <DataRow k="Construtora" v={data.construtora} />
                <DataRow k="Tipo" v={data.tipo} />
                <DataRow k="Área" v={data.area ? data.area + " m²" : ""} />
                <DataRow k="Entrega" v={data.entrega} />
              </div>
            </section>

            <section className="p-8 pt-0">
              <h3 className="font-semibold text-lg mb-2">4. Condições</h3>
              <div className="space-y-1 text-sm">
                <DataRow k="Valor total" v={brl(valores.total)} />
                <DataRow k="Entrada" v={brl(valores.entradaValor) + " (" + pct(valores.entradaPercent) + ")"} />
                <DataRow k="Obra" v={brl(valores.duranteObraTotal) + " em " + (data.duranteObraParcelas||0) + "x (" + brl(valores.duranteObraParcela) + ")"} />
                <DataRow k="Chaves" v={brl(valores.chavesTotal) + (data.chavesForma==='financiamento' ? ' (Financ.)' : data.chavesForma==='posConstrutora' ? ` em ${(data.chavesPosParcelas||0)}x` : '')} />
                {Number(data.balaoQuantidade)>0 && Number(data.balaoValor)>0 && (
                  <DataRow k="Balões" v={`${data.balaoQuantidade}× ${brl(data.balaoValor)} a cada ${data.balaoFrequenciaMeses} meses`} />
                )}
                <DataRow k="Investimento" v={brl(valores.valorInvestidoReal)} />
                <DataRow k="Validade" v={data.validade} />
              </div>
            </section>

            <section className="p-8 pt-0">
              <h3 className="font-semibold text-lg mb-3">5. Cenário 1: Revenda</h3>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <table className="w-full text-sm">
                  <tbody>
                    <TR label="Valor hoje" value={brl(valores.total)} />
                    <TR label="Valorização" value={pct(data.apreciacao)} />
                    <TR label="Valor final" value={brl(cenario1.valorFinal)} />
                    <TR label="Lucro" value={brl(cenario1.lucro)} />
                    <tr className="border-t-2 border-emerald-600">
                      <td className="p-3 font-bold text-emerald-800">ROI</td>
                      <td className="p-3 font-bold text-emerald-800 text-lg">{pct(cenario1.roi)}</td>
                    </tr>
                    <tr className="bg-emerald-100">
                      <td className="p-3 font-bold text-emerald-900">ROAS</td>
                      <td className="p-3 font-bold text-emerald-900 text-lg">{pct(cenario1.roas)}</td>
                    </tr>
                    <TR label="TIR (a.a.)" value={pct(cenario1.tir)} />
                  </tbody>
                </table>
              </div>
            </section>

            <section className="p-8 pt-0">
              <h3 className="font-semibold text-lg mb-3">6. Cenário 2: Short Stay</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="mb-3 p-3 bg-white rounded border text-xs">
                  <p className="font-semibold mb-1">Como funciona:</p>
                  <ul className="space-y-1">
                    <li>• ADR: {brl(cenario2.adrDiaria)}</li>
                    <li>• Ocupação: {data.ocupacao}% = {Math.round((data.ocupacao || 0) * 30 / 100)} diárias/mês</li>
                    <li>• Receita: {brl(cenario2.receitaMensalBruta)}/mês</li>
                    <li>• Custos: {data.custosOperacionais}%</li>
                    <li>• <strong>Líquido: {brl(cenario2.aluguelLiquido)}/mês</strong></li>
                  </ul>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-blue-100">
                      <td className="p-3 font-bold">Renda Mensal</td>
                      <td className="p-3 font-bold text-lg">{brl(cenario2.aluguelLiquido)}</td>
                    </tr>
                    <TR label={"Renda " + data.prazoShortStay + " anos"} value={brl(cenario2.rendaAcumulada)} />
                    <TR label="Valorização" value={brl(cenario2.patrimonioAcrescido)} />
                    <TR label="Valor final" value={brl(cenario2.valorFinal)} />
                    <tr className="border-t-2 bg-blue-200">
                      <td className="p-3 font-bold">RETORNO TOTAL</td>
                      <td className="p-3 font-bold text-xl">{brl(cenario2.retornoTotal)}</td>
                    </tr>
                    <tr className="border-t-2 bg-emerald-50">
                      <td className="p-3 font-bold text-emerald-800">ROI</td>
                      <td className="p-3 font-bold text-emerald-800 text-lg">{pct(cenario2.roi)}</td>
                    </tr>
                    <tr className="bg-emerald-100">
                      <td className="p-3 font-bold text-emerald-900">ROAS</td>
                      <td className="p-3 font-bold text-emerald-900 text-lg">{pct(cenario2.roas)}</td>
                    </tr>
                    <TR label="TIR (a.a.)" value={pct(cenario2.tir)} />
                  </tbody>
                </table>
              </div>
            </section>

            <section className="p-8 pt-0">
              <p className="text-xs text-gray-500 italic">
                * Estimativas baseadas em projeções de mercado.
                <br />* ROI = Retorno sobre valor total | ROAS = Retorno sobre investimento real
              </p>
            </section>

            <section className="p-8 pt-0">
              <h3 className="font-semibold mb-2">7. Contatos</h3>
              <p className="text-sm"><strong>{data.company}</strong></p>
              <p className="text-sm">{data.phone} · {data.email}</p>
              {data.siteUrl && (
                <a href={data.siteUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">{data.siteUrl}</a>
              )}
              <p className="text-xs text-gray-500 mt-4">© {new Date().getFullYear()} Alvo BR</p>
            </section>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 12mm; }
          .sticky, .lg\\:col-span-2 { display: none !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-emerald-100 { background-color: #d1fae5 !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-blue-100 { background-color: #dbeafe !important; }
          .bg-blue-200 { background-color: #bfdbfe !important; }
        }
      `}</style>
    </div>
  );
}

/********************
 * UI bits
 ********************/
function Card({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h4 className="font-semibold">{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <input
        className="w-full px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500"
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

function DataRow({ k, v }) {
  return (
    <div className="flex gap-2 py-1 border-b border-dashed border-gray-100">
      <div className="w-32 text-gray-500">{k}</div>
      <div className="flex-1 font-medium">{v || "—"}</div>
    </div>
  );
}

function TR({ label, value }) {
  return (
    <tr>
      <td className="p-3 text-gray-600">{label}</td>
      <td className="p-3 font-medium">{value || "—"}</td>
    </tr>
  );
}

/********************
 * Runtime tests
 ********************/
(function runLightTests(){
  try {
    console.assert(currencyToNumber('R$ 1.234,56') === 1234.56, 'currencyToNumber');
    console.assert(pct(12.345).startsWith('12'), 'pct formato');
    const tir = calcularTIR([-100, 60, 60]);
    console.assert(tir > 10 && tir < 50, 'TIR plausível');
    console.debug('[AlvoPropostasV2] testes rápidos OK');
  } catch(e) { console.warn('[AlvoPropostasV2] teste falhou', e); }
})();
