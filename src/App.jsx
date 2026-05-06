import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const WHATSAPP_LINK = "https://w.app/oehxvr";
const TERMOS_BUCKET = "termos";

const TERMOS_RESPONSABILIDADE = [
  ["Ferramenta independente", "este app não possui vínculo oficial com Prefeitura, Secretaria ou órgão público."],
  ["Finalidade", "o sistema auxilia no preenchimento, organização e envio dos documentos informados."],
  ["Dados", "o usuário declara que as informações e documentos enviados são verdadeiros e de sua responsabilidade."],
  ["Dependência externa", "o funcionamento pode depender de formulário, e-mail ou plataforma de terceiros."],
  ["Alterações externas", "se o formulário oficial mudar, o app poderá ficar temporariamente indisponível até atualização."],
  ["Acesso individual", "o código é pessoal e vinculado aos dados cadastrados."],
  ["PWA", "remover o app, limpar dados ou trocar de aparelho pode exigir nova liberação."],
  ["Resultado", "o app não garante deferimento, prazo de resposta ou aceitação pelo órgão destinatário."],
];

const mapSupabaseUser = (dbUser) => ({
  id: dbUser.id,
  nome: dbUser.nome || "",
  cpf: formatCPF(dbUser.cpf || ""),
  cargo: dbUser.cargo || "",
  orgao: dbUser.orgao || "",
  mat1: dbUser.mat1 || "",
  mat2: dbUser.mat2 || "",
  unid1: dbUser.unid1 || "",
  unid2: dbUser.unid2 || "",
  sit: dbUser.sit || "Efetivo(a)",
  tel: formatPhone(dbUser.telefone || dbUser.tel || ""),
  email: dbUser.email || "",
  codigo: dbUser.codigo || "",
  status: dbUser.status || "Disponível",
  validade: dbUser.validade || "",
});

const isExpired = (validade) => {
  if (!validade) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(`${validade}T23:59:59`);
  return vencimento < hoje;
};

const emptyUser = {
  nome: "",
  cpf: "",
  cargo: "",
  orgao: "",
  mat1: "",
  mat2: "",
  unid1: "",
  unid2: "",
  sit: "Efetivo(a)",
  tel: "",
  email: "",
};

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

const formatCPF = (value) => {
  const v = onlyDigits(value).slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatPhone = (value) => {
  const v = onlyDigits(value).slice(0, 11);
  if (v.length <= 10) {
    return v
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return v
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const isValidCPF = (value) => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (base) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (base.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const digit1 = calcDigit(cpf.slice(0, 9));
  const digit2 = calcDigit(cpf.slice(0, 10));
  return digit1 === Number(cpf[9]) && digit2 === Number(cpf[10]);
};

const isValidPhone = (value) => {
  const phone = onlyDigits(value);
  if (phone.length !== 10 && phone.length !== 11) return false;
  if (/^(\d)\1+$/.test(phone)) return false;
  return true;
};

const normalizeDraftField = (field, value) => {
  if (field === "cpf") return formatCPF(value);
  if (field === "tel") return formatPhone(value);
  return value;
};

const getFieldError = (field, value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (field === "cpf") {
    if (onlyDigits(raw).length < 11) return "CPF incompleto.";
    if (!isValidCPF(raw)) return "CPF inválido.";
  }

  if (field === "tel") {
    if (onlyDigits(raw).length < 10) return "Telefone incompleto.";
    if (!isValidPhone(raw)) return "Telefone inválido.";
  }

  return "";
};


const Shell = ({ children }) => (
  <div className="max-w-md mx-auto min-h-screen bg-slate-50 text-slate-800 font-sans shadow-2xl">{children}</div>
);

const Header = ({ badge, title, subtitle }) => (
  <div className="bg-gradient-to-br from-blue-700 to-blue-950 text-white px-6 pt-8 pb-8 rounded-b-[2rem] shadow-lg">
    <span className="inline-block bg-white/15 px-3 py-1 rounded-full text-sm font-extrabold mb-4">{badge}</span>
    <h1 className="text-3xl font-black leading-tight">{title}</h1>
    {subtitle && <p className="text-base text-blue-100 mt-3 leading-relaxed font-semibold">{subtitle}</p>}
  </div>
);

const Topbar = ({ small, title, backTo, showReset, onBack, onReset }) => (
  <div className="flex justify-between items-center px-5 pt-5 mb-4">
    <div>
      <span className="text-sm font-black text-blue-700">{small}</span>
      <p className="text-xl font-black text-slate-900 leading-tight">{title}</p>
    </div>
    {backTo && <button onClick={() => onBack(backTo)} className="text-base font-black text-slate-600 underline">Voltar</button>}
    {showReset && <button onClick={onReset} className="text-sm font-black text-red-700 underline">Apagar</button>}
  </div>
);

const IconCamera = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconCheck = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconFile = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconSend = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconTrash = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [previousTermsScreen, setPreviousTermsScreen] = useState("welcome");
  const [accessCode, setAccessCode] = useState("");
  const [authorizedCode, setAuthorizedCode] = useState("");
  const [draftUser, setDraftUser] = useState(emptyUser);
  const [user, setUser] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [leaveType, setLeaveType] = useState("01_03");
  const [shift, setShift] = useState("");
  const [acompType, setAcompType] = useState("01_03");
  const [kinship, setKinship] = useState("");
  const [atestadoDoc, setAtestadoDoc] = useState(null);
  const [identidadeDoc, setIdentidadeDoc] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const storageKey = useMemo(() => (authorizedCode ? `atestado_facil_${authorizedCode}` : ""), [authorizedCode]);
  const identityKey = useMemo(() => (authorizedCode ? `saved_identidade_${authorizedCode}` : ""), [authorizedCode]);

  const btnBase = "w-full p-5 text-xl font-extrabold rounded-2xl transition-all duration-200 text-center flex flex-col items-center justify-center gap-2 shadow-md active:scale-95";
  const btnPrimary = `${btnBase} bg-blue-700 text-white border-4 border-blue-900`;
  const btnSecondary = `${btnBase} bg-white text-slate-800 border-4 border-slate-300`;
  const btnSuccess = `${btnBase} bg-green-700 text-white border-4 border-green-900`;

  useEffect(() => {
    if (!window.PDFLib && !document.querySelector('script[data-pdf-lib="true"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js";
      script.async = true;
      script.dataset.pdfLib = "true";
      document.head.appendChild(script);
    }

    const savedCode = localStorage.getItem("atestado_facil_last_code");
    if (savedCode) {
      validarCodigoSupabase(savedCode, true);
    }
  }, []);

  useEffect(() => {
    if (!identityKey) return;
    const savedId = localStorage.getItem(identityKey);
    setIdentidadeDoc(savedId ? JSON.parse(savedId) : null);
  }, [identityKey]);

  const go = (name) => {
    setScreen(name);
    window.scrollTo(0, 0);
  };

  const openTerms = (from) => {
    setPreviousTermsScreen(from);
    go("terms");
  };

  const normalizarStatus = (status) => String(status || "Disponível").trim().toLowerCase();

  const addMonthsToToday = (months = 3) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split("T")[0];
  };

  const validarCodigoSupabase = async (codigoInformado = accessCode, silencioso = false) => {
    const code = codigoInformado.trim().toUpperCase();

    if (!code) {
      if (!silencioso) alert("Digite o código de acesso.");
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("codigo", code)
      .maybeSingle();

    if (error) {
      console.error(error);
      if (!silencioso) alert("Erro ao consultar o código no Supabase.");
      return;
    }

    if (!data) {
      if (!silencioso) alert("Código inválido ou não liberado. Entre em contato com o suporte.");
      return;
    }

    const status = normalizarStatus(data.status);

    if (status === "bloqueado") {
      if (!silencioso) alert("Este acesso está bloqueado. Entre em contato com o suporte.");
      resetAccess(false);
      return;
    }

    if (status === "vencido" || isExpired(data.validade)) {
      await supabase.from("usuarios").update({ status: "Vencido" }).eq("codigo", code);
      if (!silencioso) alert("Este acesso venceu. Entre em contato com o suporte para renovar.");
      resetAccess(false);
      return;
    }

    const supabaseUser = mapSupabaseUser(data);
    setAuthorizedCode(code);
    setAccessCode(code);

    // Fluxo novo: código disponível/pending abre cadastro. O usuário se vincula sozinho.
    if (status === "disponível" || status === "disponivel" || status === "pendente") {
      setDraftUser({ ...emptyUser, id: data.id, codigo: code, status: "Disponível" });
      setUser(null);
      setAcceptedTerms(false);
      go("register");
      return;
    }

    // Código ativo: entra direto usando os dados do Supabase.
    if (status === "ativo") {
      if (!supabaseUser.nome || !supabaseUser.cpf) {
        setDraftUser({ ...emptyUser, ...supabaseUser, codigo: code, status: "Disponível" });
        setUser(null);
        setAcceptedTerms(false);
        go("register");
        return;
      }

      const usuarioFinal = { ...supabaseUser, codigo: code, status: "Ativo" };
      localStorage.setItem(`atestado_facil_${code}`, JSON.stringify({ user: usuarioFinal, activatedAt: data.usado_em || new Date().toISOString() }));
      localStorage.setItem("atestado_facil_last_code", code);
      setDraftUser(usuarioFinal);
      setUser(usuarioFinal);
      setAcceptedTerms(true);
      go("home");
      return;
    }

    if (!silencioso) alert("Este código ainda não está liberado para uso. Entre em contato com o suporte.");
  };

  const validateAccessCode = () => validarCodigoSupabase(accessCode, false);

  const updateDraft = (field, value) => setDraftUser((prev) => ({ ...prev, [field]: normalizeDraftField(field, value) }));

  const activateAccess = async () => {
    const required = ["nome", "cpf", "cargo", "orgao", "mat1", "unid1", "tel", "email"];
    const missing = required.find((field) => !String(draftUser[field] || "").trim());
    if (missing) {
      alert("Preencha todos os dados obrigatórios antes de continuar.");
      return;
    }

    if (!isValidCPF(draftUser.cpf)) {
      alert("Confira o CPF. Ele está incompleto ou inválido.");
      return;
    }

    if (!isValidPhone(draftUser.tel)) {
      alert("Confira o telefone. Ele está incompleto ou inválido.");
      return;
    }

    if (!acceptedTerms) {
      alert("Você precisa aceitar os termos de uso e responsabilidade.");
      return;
    }

    const validadeAutomatica = addMonthsToToday(3);
    const usadoEm = new Date().toISOString();
    const finalUser = {
      ...draftUser,
      codigo: authorizedCode,
      status: "Ativo",
      validade: validadeAutomatica,
    };

    let termosPdfUrl = "";
    try {
      termosPdfUrl = await salvarPdfTermosNoSupabase(finalUser, usadoEm);
    } catch (pdfError) {
      console.error(pdfError);
      alert("Não foi possível gerar o PDF dos termos. Confira se o bucket 'termos' existe no Supabase.");
      return;
    }

    const { error } = await supabase
      .from("usuarios")
      .update({
        nome: finalUser.nome,
        cpf: finalUser.cpf,
        telefone: finalUser.tel,
        email: finalUser.email,
        cargo: finalUser.cargo,
        orgao: finalUser.orgao,
        mat1: finalUser.mat1,
        mat2: finalUser.mat2,
        unid1: finalUser.unid1,
        unid2: finalUser.unid2,
        sit: finalUser.sit,
        status: "Ativo",
        validade: validadeAutomatica,
        usado_em: usadoEm,
        termos_aceitos: true,
        termos_aceitos_em: usadoEm,
        termos_pdf: termosPdfUrl,
      })
      .eq("codigo", authorizedCode);

    if (error) {
      console.error(error);
      alert("Erro ao ativar o acesso. Tente novamente ou chame o suporte.");
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify({ user: finalUser, activatedAt: usadoEm }));
    localStorage.setItem("atestado_facil_last_code", authorizedCode);

    setUser(finalUser);
    go("home");
  };

  const resetAccess = (perguntar = true) => {
    if (perguntar && !confirm("Deseja apagar o acesso salvo neste aparelho?")) return;
    if (storageKey) localStorage.removeItem(storageKey);
    if (identityKey) localStorage.removeItem(identityKey);
    localStorage.removeItem("atestado_facil_last_code");
    setAuthorizedCode("");
    setAccessCode("");
    setUser(null);
    setDraftUser(emptyUser);
    setAcceptedTerms(false);
    setIdentidadeDoc(null);
    setAtestadoDoc(null);
    go("welcome");
  };

  const requestEdit = () => {
    window.open(`${WHATSAPP_LINK}?text=${encodeURIComponent("Olá! Quero solicitar alteração cadastral no Atestado Fácil.")}`, "_blank");
  };

  const handleFileRead = (e, setter, saveLocal = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const doc = { name: file.name || "documento", type: file.type || "application/octet-stream", dataUrl: event.target.result };
      setter(doc);
      if (saveLocal && identityKey) localStorage.setItem(identityKey, JSON.stringify(doc));
    };
    reader.readAsDataURL(file);
  };

  const removeSavedId = () => {
    if (identityKey) localStorage.removeItem(identityKey);
    setIdentidadeDoc(null);
  };

  const waitForPDFLib = () => new Promise((resolve, reject) => {
    if (window.PDFLib) return resolve(window.PDFLib);
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.PDFLib) {
        clearInterval(timer);
        resolve(window.PDFLib);
      }
      if (tries > 80) {
        clearInterval(timer);
        reject(new Error("Biblioteca de PDF não carregou. Recarregue a página."));
      }
    }, 100);
  });

  const gerarPdfTermosResponsabilidade = async (usuarioFinal, dataAceiteISO) => {
    const pdfLib = await waitForPDFLib();
    const { PDFDocument, StandardFonts, rgb } = pdfLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.25, 842]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const blue = rgb(0.08, 0.22, 0.48);
    const gray = rgb(0.35, 0.39, 0.45);

    const drawWrapped = (text, x, y, maxWidth, size = 10.5, lineHeight = 15, usedFont = font) => {
      const words = String(text || "").split(/\s+/).filter(Boolean);
      const lines = [];
      let line = "";

      words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        if (usedFont.widthOfTextAtSize(testLine, size) <= maxWidth) {
          line = testLine;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      });
      if (line) lines.push(line);

      lines.forEach((lineText, index) => {
        page.drawText(lineText, { x, y: y - index * lineHeight, size, font: usedFont, color: black });
      });

      return y - lines.length * lineHeight;
    };

    const dataAceite = new Date(dataAceiteISO).toLocaleString("pt-BR");

    page.drawText("Atestado Fácil", { x: 45, y: 790, size: 13, font: bold, color: blue });
    page.drawText("TERMO DE RESPONSABILIDADE E CIÊNCIA", { x: 45, y: 755, size: 18, font: bold, color: black });
    page.drawText("Aceite realizado eletronicamente pelo usuário no primeiro acesso ao aplicativo.", { x: 45, y: 733, size: 10.5, font, color: gray });

    page.drawLine({ start: { x: 45, y: 715 }, end: { x: 550, y: 715 }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });

    let y = 685;
    const info = [
      ["Nome", usuarioFinal.nome],
      ["CPF", usuarioFinal.cpf],
      ["E-mail", usuarioFinal.email],
      ["Telefone", usuarioFinal.tel],
      ["Código de acesso", usuarioFinal.codigo],
      ["Data e hora do aceite", dataAceite],
    ];

    info.forEach(([label, value]) => {
      page.drawText(`${label}:`, { x: 45, y, size: 10.5, font: bold, color: black });
      page.drawText(String(value || "—"), { x: 160, y, size: 10.5, font, color: black });
      y -= 18;
    });

    y -= 12;
    page.drawText("Declaração", { x: 45, y, size: 13, font: bold, color: blue });
    y -= 24;
    y = drawWrapped("Ao marcar a caixa de aceite no aplicativo, o usuário declara que leu, compreendeu e concorda com os termos abaixo:", 45, y, 500, 10.5, 15, font);
    y -= 12;

    TERMOS_RESPONSABILIDADE.forEach(([titulo, texto], index) => {
      page.drawText(`${index + 1}. ${titulo}:`, { x: 45, y, size: 10.5, font: bold, color: black });
      y = drawWrapped(texto, 65, y - 16, 470, 10.5, 15, font);
      y -= 8;
    });

    page.drawLine({ start: { x: 45, y: 105 }, end: { x: 550, y: 105 }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
    page.drawText("Registro gerado automaticamente pelo Atestado Fácil.", { x: 45, y: 82, size: 9, font, color: gray });
    page.drawText("Este documento comprova o aceite eletrônico dos termos de responsabilidade.", { x: 45, y: 68, size: 9, font, color: gray });

    const bytes = await pdfDoc.save({ useObjectStreams: true });
    return new Blob([bytes], { type: "application/pdf" });
  };

  const salvarPdfTermosNoSupabase = async (usuarioFinal, dataAceiteISO) => {
    const pdfBlob = await gerarPdfTermosResponsabilidade(usuarioFinal, dataAceiteISO);
    const safeCode = onlyDigits(usuarioFinal.codigo) || String(usuarioFinal.codigo || "codigo").replace(/[^a-z0-9_-]/gi, "");
    const fileName = `termo-${safeCode}-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(TERMOS_BUCKET)
      .upload(fileName, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(TERMOS_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  };

  const dataUrlToUint8Array = (dataUrl) => {
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const compressImageDataUrl = (dataUrl, maxWidth = 1500, quality = 0.78) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

  const formatDataLongBR = (dataString) => {
    if (!dataString) return "";
    const [ano, mes, dia] = dataString.split("-");
    const meses = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
    return `${Number(dia)} de ${meses[Number(mes) - 1]} de ${ano}`;
  };

  const splitData = (dataString) => {
    const [ano, mes, dia] = dataString.split("-");
    return { dia, mes, ano, completa: `${dia}/${mes}/${ano}` };
  };

  const fillOfficialForm = async (pdfDoc, pdfLib) => {
    const { StandardFonts, rgb } = pdfLib;
    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const d = splitData(date);
    const draw = (text, x, y, opts = {}) => {
      if (!text) return;

      // Ajuste fino dos campos preenchidos no PDF oficial.
      // Mantém o tamanho quase igual ao original, mas cria um respiro mínimo
      // para o texto não ficar encostado na linha superior do campo.
      const { f = font, size = 10.5, maxW = 200, yOffset = 0.65 } = opts;

      let s = size;
      const t = String(text);

      while (f.widthOfTextAtSize(t, s) > maxW && s > 7.8) s -= 0.15;

      page.drawText(t, {
  x: x + 3,
  y: y + 2,
  size: s,
  font: f,
  color: black,
});
    };
    const markX = (x, y) => page.drawText("X", { x: x + 1, y: y + 1, size: 9, font: bold, color: black });
    draw(user.nome, 112, 711, { maxW: 305 });
    draw(user.cpf, 453, 711, { maxW: 100 });
    draw(user.cargo, 101, 696, { maxW: 200 });
    draw(user.orgao, 383, 696, { maxW: 170 });
    draw(user.mat1, 96, 681, { maxW: 200 });
    draw(user.unid1, 148, 666, { maxW: 125 });
    draw(user.tel, 95, 626, { maxW: 95 });
    draw(user.email, 228, 626, { maxW: 320 });
    if (user.sit === "Efetivo(a)") markX(103, 650);
    if (user.sit === "Comissionado(a)") markX(168, 650);
    if (user.sit === "Contratado(a)") markX(265, 649);
    const drawDate = (diaX, mesX, anoX, y) => {
      draw(d.dia, diaX + 1, y, { f: bold, size: 11, maxW: 20 });
      draw(d.mes, mesX + 1, y, { f: bold, size: 11, maxW: 25 });
      draw(d.ano, anoX + 1, y, { f: bold, size: 11, maxW: 28 });
    };
    if (leaveType === "01_03") { markX(35, 551); drawDate(283.9, 312.6, 347.1, 552); }
    if (leaveType === "04_15") { if (shift === "manha") markX(371, 501); if (shift === "tarde") markX(458, 500); markX(35, 481); drawDate(283.9, 312.6, 347.1, 483); }
    if (leaveType === "acima_15") { if (shift === "manha") markX(372, 430); if (shift === "tarde") markX(457, 429); markX(35, 410); drawDate(283.9, 312.6, 347.1, 412); }
    if (leaveType === "acidente") { if (shift === "manha") markX(374, 387); if (shift === "tarde") markX(458, 387); markX(35, 368); drawDate(259.5, 288.1, 322.7, 369); }
    if (leaveType === "acompanhamento") { markX(35, 345); if (shift === "manha") markX(371, 345); if (shift === "tarde") markX(458, 346); if (acompType === "01_03") markX(164, 326); if (acompType === "acima_04") markX(164, 311); drawDate(174.6, 203.2, 237.9, 296); draw(kinship, 338, 281, { maxW: 220 }); }
    draw(d.dia, 285, 35, { f: bold, size: 11, maxW: 22 });
    draw(d.mes, 312, 35, { f: bold, size: 11, maxW: 22 });
    draw(d.ano, 339, 35, { f: bold, size: 11, maxW: 40 });
  };

  const appendDocumentPages = async (pdfDoc, pdfLib, docFile) => {
    const { PDFDocument } = pdfLib;
    if (!docFile?.dataUrl) return;
    if (docFile.dataUrl.startsWith("data:application/pdf")) {
      const donor = await PDFDocument.load(dataUrlToUint8Array(docFile.dataUrl));
      const copiedPages = await pdfDoc.copyPages(donor, donor.getPageIndices());
      copiedPages.forEach((p) => pdfDoc.addPage(p));
      return;
    }
    const jpegDataUrl = await compressImageDataUrl(docFile.dataUrl, 1600, 0.78);
    const image = await pdfDoc.embedJpg(dataUrlToUint8Array(jpegDataUrl));
    const page = pdfDoc.addPage([595.25, 842]);
    const margin = 28;
    const maxW = page.getWidth() - margin * 2;
    const maxH = page.getHeight() - margin * 2;
    const scale = Math.min(maxW / image.width, maxH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: (page.getWidth() - w) / 2, y: (page.getHeight() - h) / 2, width: w, height: h });
  };

  const generateAndSharePDF = async () => {
    setIsGenerating(true);
    try {
      if (!user) { alert("Faça o acesso antes de enviar."); return; }
      if (!atestadoDoc) { alert("Antes de enviar, anexe o atestado."); return; }
      if (!identidadeDoc) { alert("Antes de enviar, salve a identidade."); return; }
      const pdfLib = await waitForPDFLib();
      const { PDFDocument } = pdfLib;
      const templateResponse = await fetch("/formulario_pericia.pdf");
      if (!templateResponse.ok) throw new Error("Arquivo public/formulario_pericia.pdf não encontrado.");
      const templateBytes = await templateResponse.arrayBuffer();
      const pdfDoc = await PDFDocument.load(templateBytes);
      await fillOfficialForm(pdfDoc, pdfLib);
      await appendDocumentPages(pdfDoc, pdfLib, atestadoDoc);
      await appendDocumentPages(pdfDoc, pdfLib, identidadeDoc);
      const bytes = await pdfDoc.save({ useObjectStreams: true });
      const pdfBlob = new Blob([bytes], { type: "application/pdf" });
      const fileName = `Formulario_${user.nome.split(" ")[0]}_${date.replace(/-/g, "")}.pdf`;
      const pdfBase64 = await blobToBase64(pdfBlob);
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, pdfBase64, userName: user.nome, userEmail: user.email }),
      });
      const rawText = await response.text();
      let data = {};
      try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { error: rawText }; }
      if (!response.ok) { console.error("Erro da API:", data); alert(data.error || "Erro ao enviar o e-mail. Tente novamente."); return; }
      const logKey = `logs_${authorizedCode}`;
      const logs = JSON.parse(localStorage.getItem(logKey) || "[]");
      logs.unshift({ date: new Date().toLocaleString("pt-BR"), fileName, status: "Enviado" });
      localStorage.setItem(logKey, JSON.stringify(logs.slice(0, 50)));
      alert("E-mail enviado com sucesso!");
      go("success");
    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao gerar ou enviar o PDF. Tente novamente.");
    } finally { setIsGenerating(false); }
  };

  const sentCount = authorizedCode ? JSON.parse(localStorage.getItem(`logs_${authorizedCode}`) || "[]").length : 0;
  const dataFields = [
    ["nome", "Nome completo", "Digite seu nome completo"], ["cpf", "CPF", "000.000.000-00"], ["cargo", "Cargo/Função", "Ex: Auxiliar de Secretaria Escolar"], ["orgao", "Órgão (lotação)", "Ex: SEDUC"], ["mat1", "Mat. 1º cargo", "Digite a matrícula"], ["mat2", "Mat. 2º cargo", "Opcional"], ["unid1", "Unid. (lotação) 1º cargo", "Ex: Escola / CEMEI / Unidade"], ["unid2", "Unid. (lotação) 2º cargo", "Opcional"], ["tel", "Telefone", "(00) 00000-0000"], ["email", "E-mail", "email@email.com"],
  ];

  if (screen === "welcome") return <Shell><Header badge="Bem-vindo" title="Atestado Fácil" subtitle="Preencha o Formulário Solicitação Perícia Médica de forma simples, com suporte e segurança." /><div className="p-5"><div className="bg-white rounded-3xl border-4 border-blue-100 p-5 shadow-sm"><h2 className="text-2xl font-black text-slate-900 mb-2">Entrar no app</h2><p className="text-slate-600 font-bold leading-relaxed">Use seu código de acesso para continuar.</p><button className={`${btnPrimary} mt-5`} onClick={() => go("code")}>TENHO CÓDIGO</button><a className={`${btnSecondary} mt-3 no-underline`} href={WHATSAPP_LINK} target="_blank" rel="noreferrer">SOLICITAR ACESSO</a><button onClick={() => openTerms("welcome")} className="w-full text-center text-slate-500 font-black underline text-sm mt-4">Termos e responsabilidade</button></div><div className="bg-blue-50 text-blue-900 border-2 border-blue-200 rounded-2xl p-4 mt-4 text-sm font-bold leading-relaxed">Ferramenta independente, sem vínculo oficial com Prefeitura ou órgão público.</div></div></Shell>;
  if (screen === "code") return <Shell><Header badge="Código" title="Acesso liberado" subtitle="Digite o código informado pelo suporte." /><div className="p-5"><div className="bg-white rounded-3xl border-4 border-blue-100 p-5 shadow-sm"><h2 className="text-2xl font-black text-slate-900 mb-4">Código de acesso</h2><input value={accessCode} onChange={(e) => setAccessCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={12} className="w-full p-5 rounded-2xl border-4 border-slate-200 bg-slate-50 text-2xl font-black outline-none focus:border-blue-500 text-center tracking-[0.25em] uppercase" /><button className={`${btnPrimary} mt-5`} onClick={validateAccessCode}>CONTINUAR</button><button className={`${btnSecondary} mt-3`} onClick={() => go("welcome")}>VOLTAR</button></div></div></Shell>;
  if (screen === "terms") return <Shell><Header badge="Termos" title="Responsabilidade" subtitle="Uso simples, transparente e independente." /><div className="p-5"><div className="bg-white rounded-3xl border-4 border-blue-100 p-5 shadow-sm"><h2 className="text-2xl font-black text-slate-900 mb-4">Antes de usar</h2><div className="max-h-[420px] overflow-auto bg-slate-50 border-4 border-dashed border-slate-200 rounded-2xl p-4 text-sm leading-relaxed text-slate-700 font-bold flex flex-col gap-3"><p><b>Ferramenta independente:</b> este app não possui vínculo oficial com Prefeitura, Secretaria ou órgão público.</p><p><b>Finalidade:</b> o sistema auxilia no preenchimento, organização e envio dos documentos informados.</p><p><b>Dados:</b> o usuário declara que as informações e documentos enviados são verdadeiros e de sua responsabilidade.</p><p><b>Dependência externa:</b> o funcionamento pode depender de formulário, e-mail ou plataforma de terceiros.</p><p><b>Alterações externas:</b> se o formulário oficial mudar, o app poderá ficar temporariamente indisponível até atualização.</p><p><b>Acesso individual:</b> o código é pessoal e vinculado aos dados cadastrados.</p><p><b>PWA:</b> remover o app, limpar dados ou trocar de aparelho pode exigir nova liberação.</p><p><b>Resultado:</b> o app não garante deferimento, prazo de resposta ou aceitação pelo órgão destinatário.</p></div><button className={`${btnPrimary} mt-5`} onClick={() => go(previousTermsScreen)}>ENTENDI</button></div></div></Shell>;
  if (screen === "register") return (
    <Shell>
      <Header badge="Primeiro acesso" title="Seus dados" subtitle="Preencha uma vez para gerar os próximos formulários." />
      <div className="p-5">
        <div className="bg-white rounded-3xl border-4 border-blue-100 p-5 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900 mb-2">Dados do formulário</h2>
          {dataFields.map(([field, label, placeholder]) => {
            const error = getFieldError(field, draftUser[field]);
            const hasError = Boolean(error);
            const isValidatedField = field === "cpf" || field === "tel";

            return (
              <label key={field} className="block mt-4">
                <span className="block text-sm font-black text-slate-600 mb-2">{label}</span>
                <input
                  value={draftUser[field] || ""}
                  onChange={(e) => updateDraft(field, e.target.value)}
                  placeholder={placeholder}
                  inputMode={field === "cpf" || field === "tel" ? "numeric" : undefined}
                  maxLength={field === "cpf" ? 14 : field === "tel" ? 15 : undefined}
                  className={`w-full p-4 rounded-2xl border-4 bg-slate-50 text-lg font-bold outline-none ${hasError ? "border-red-400 focus:border-red-600" : "border-slate-200 focus:border-blue-500"}`}
                />
                {hasError && <p className="text-red-600 text-sm font-black mt-2">{error}</p>}
                {isValidatedField && !hasError && draftUser[field] && (
                  <p className="text-green-700 text-sm font-black mt-2">Formato correto.</p>
                )}
              </label>
            );
          })}
          <label className="block mt-4">
            <span className="block text-sm font-black text-slate-600 mb-2">Situação funcional</span>
            <select value={draftUser.sit} onChange={(e) => updateDraft("sit", e.target.value)} className="w-full p-4 rounded-2xl border-4 border-slate-200 bg-slate-50 text-lg font-bold outline-none focus:border-blue-500">
              <option>Efetivo(a)</option>
              <option>Comissionado(a)</option>
              <option>Contratado(a)</option>
            </select>
          </label>
          <label className="flex items-start gap-3 bg-slate-100 rounded-2xl p-4 mt-5">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="w-7 h-7 mt-1" />
            <span className="text-sm font-bold text-slate-700 leading-relaxed">Li e aceito os termos de uso e responsabilidade.</span>
          </label>
          <button className={`${btnPrimary} mt-5`} onClick={activateAccess}>ATIVAR ACESSO</button>
          <button className={`${btnSecondary} mt-3`} onClick={() => openTerms("register")}>LER TERMOS</button>
        </div>
      </div>
    </Shell>
  );
  if (screen === "home") return <Shell><Topbar small="Atestado Fácil" title={user?.nome?.split(" ")[0] || "Usuário"} showReset onReset={resetAccess} /><div className="p-5 pt-0"><div className="bg-gradient-to-br from-blue-700 to-blue-950 text-white rounded-3xl p-6 shadow-lg mb-4"><span className="inline-block bg-green-300 text-green-950 px-3 py-1 rounded-full text-sm font-black mb-4">Acesso ativo</span><h1 className="text-3xl font-black leading-tight">Olá, {user?.nome?.split(" ")[0]}!</h1><p className="text-blue-100 mt-3 text-lg leading-relaxed font-bold">Gere e envie seu formulário em poucos passos.</p></div><div className="grid grid-cols-2 gap-3 mb-4"><div className="bg-white rounded-2xl border-4 border-blue-100 p-4 text-center"><strong className="block text-2xl text-blue-700">Ativo</strong><span className="text-sm font-black text-slate-500">Status</span></div><div className="bg-white rounded-2xl border-4 border-blue-100 p-4 text-center"><strong className="block text-2xl text-blue-700">{sentCount}</strong><span className="text-sm font-black text-slate-500">Envios</span></div></div><div className="bg-white rounded-3xl border-4 border-blue-100 p-5 shadow-sm mb-4 flex items-center gap-4"><div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl">📄</div><div><b className="text-xl font-black">Novo formulário</b><p className="text-sm text-slate-500 font-bold leading-relaxed">Informe o atestado, anexe os documentos e confira antes de enviar.</p></div></div><button className={btnPrimary} onClick={() => go("data")}>COMEÇAR ENVIO</button></div></Shell>;
  if (screen === "data") return <Shell><Topbar small="Passo 1 de 4" title="Atestado" backTo="home" onBack={go} /><div className="p-5 pt-0 flex flex-col gap-5"><div className="bg-white p-6 rounded-2xl border-4 border-slate-200 shadow-sm overflow-hidden"><label className="block text-2xl font-bold text-slate-800 mb-4">Data de início:</label><div className="relative w-full h-20 border-4 border-blue-400 rounded-2xl bg-blue-50 overflow-hidden flex items-center justify-center px-2"><span className="text-2xl font-extrabold text-slate-900 leading-none text-center pointer-events-none whitespace-nowrap">{formatDataLongBR(date)}</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Data de início do atestado" /></div></div><div className="bg-white p-6 rounded-2xl border-4 border-slate-200 shadow-sm flex flex-col gap-4"><label className="block text-2xl font-bold text-slate-800 mb-2">Tipo:</label>{[{ id: "01_03", label: "De 01 a 03 dias" }, { id: "04_15", label: "De 04 a 15 dias" }, { id: "acima_15", label: "Acima de 15 dias" }, { id: "acompanhamento", label: "Acompanhamento" }].map((opt) => <label key={opt.id} className={`flex items-center gap-4 p-4 border-4 rounded-xl cursor-pointer transition-colors ${leaveType === opt.id ? "border-blue-600 bg-blue-50" : "border-slate-300"}`}><input type="radio" name="dias" className="w-8 h-8 text-blue-600" checked={leaveType === opt.id} onChange={() => { setLeaveType(opt.id); setShift(""); }} /><span className="text-2xl font-bold">{opt.label}</span></label>)}</div>{leaveType !== "01_03" && <div className="bg-white p-6 rounded-2xl border-4 border-slate-200 shadow-sm flex flex-col gap-4"><label className="block text-2xl font-bold text-slate-800 mb-2">Turno:</label><div className="flex gap-4"><label className={`flex-1 flex items-center justify-center gap-2 p-4 border-4 rounded-xl cursor-pointer ${shift === "manha" ? "border-blue-600 bg-blue-50" : "border-slate-300"}`}><input type="radio" name="turno" className="w-6 h-6" checked={shift === "manha"} onChange={() => setShift("manha")} /><span className="text-xl font-bold">Manhã</span></label><label className={`flex-1 flex items-center justify-center gap-2 p-4 border-4 rounded-xl cursor-pointer ${shift === "tarde" ? "border-blue-600 bg-blue-50" : "border-slate-300"}`}><input type="radio" name="turno" className="w-6 h-6" checked={shift === "tarde"} onChange={() => setShift("tarde")} /><span className="text-xl font-bold">Tarde</span></label></div></div>}{leaveType === "acompanhamento" && <div className="bg-indigo-50 p-6 rounded-2xl border-4 border-indigo-200 shadow-sm flex flex-col gap-4"><label className="block text-xl font-bold text-indigo-900 mb-2">Detalhes do acompanhamento:</label><label className={`flex items-center gap-4 p-3 border-2 rounded-lg cursor-pointer bg-white ${acompType === "01_03" ? "border-indigo-600" : "border-slate-300"}`}><input type="radio" name="acompType" className="w-6 h-6" checked={acompType === "01_03"} onChange={() => setAcompType("01_03")} /><span className="text-lg font-bold text-slate-700">De 01 a 03 dias</span></label><label className={`flex items-center gap-4 p-3 border-2 rounded-lg cursor-pointer bg-white ${acompType === "acima_04" ? "border-indigo-600" : "border-slate-300"}`}><input type="radio" name="acompType" className="w-6 h-6" checked={acompType === "acima_04"} onChange={() => setAcompType("acima_04")} /><span className="text-lg font-bold text-slate-700">Acima de 04 dias</span></label><label className="block text-lg font-bold text-indigo-900 mt-2">Grau de parentesco:</label><input type="text" placeholder="Ex: Filho, Mãe, Cônjuge..." value={kinship} onChange={(e) => setKinship(e.target.value)} className="w-full text-xl p-3 border-2 border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-600 font-bold" /></div>}<button className={btnSuccess} onClick={() => { if (leaveType !== "01_03" && !shift) { alert("Por favor, selecione o turno."); return; } if (leaveType === "acompanhamento" && !kinship.trim()) { alert("Por favor, informe o grau de parentesco."); return; } go("docs"); }}>AVANÇAR</button></div></Shell>;
  if (screen === "docs") return <Shell><Topbar small="Passo 2 de 4" title="Documentos" backTo="data" onBack={go} /><div className="p-5 pt-0 flex flex-col gap-5"><div className="bg-white p-4 rounded-2xl border-4 border-slate-200"><h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">ATESTADO</h2><label className={`cursor-pointer ${atestadoDoc ? btnSecondary + " border-green-500" : btnPrimary}`}>{atestadoDoc ? <><IconCheck /><span className="text-green-700">Atestado anexado!</span><span className="text-lg text-slate-500 underline mt-2">Trocar</span></> : <><IconCamera />ANEXAR ATESTADO</>}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileRead(e, setAtestadoDoc)} /></label></div><div className="bg-white p-4 rounded-2xl border-4 border-slate-200"><h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">IDENTIDADE</h2><label className={`cursor-pointer ${identidadeDoc ? btnSecondary + " border-green-500" : btnSecondary}`}>{identidadeDoc ? <><IconCheck /><span className="text-green-700 text-xl">Identidade salva!</span><span className="text-lg text-slate-500 underline mt-2">Trocar</span></> : <><IconCamera />SALVAR IDENTIDADE</>}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileRead(e, setIdentidadeDoc, true)} /></label>{identidadeDoc && <button onClick={removeSavedId} className="w-full mt-4 p-4 flex items-center justify-center gap-2 text-red-700 font-bold text-xl border-2 border-red-200 rounded-lg bg-red-50"><IconTrash /> Apagar identidade</button>}</div><button className={`${atestadoDoc ? btnSuccess : btnBase + " bg-slate-300 text-slate-500 cursor-not-allowed border-slate-400"}`} onClick={() => { if (!atestadoDoc) return; if (!identidadeDoc) { alert("Antes de continuar, salve a identidade."); return; } go("preview"); }} disabled={!atestadoDoc}>{atestadoDoc ? "AVANÇAR" : "FALTA O ATESTADO"}</button></div></Shell>;
  if (screen === "preview") { const typeLabel = { "01_03": "De 01 a 03 dias", "04_15": "De 04 a 15 dias", "acima_15": "Acima de 15 dias", acompanhamento: "Acompanhamento" }[leaveType]; return <Shell><Topbar small="Passo 3 de 4" title="Conferência" backTo="docs" onBack={go} /><div className="p-5 pt-0"><div className="bg-white rounded-3xl border-4 border-blue-100 p-5 shadow-sm"><h2 className="text-2xl font-black text-slate-900 mb-2">Confira os dados</h2><p className="text-slate-600 font-bold leading-relaxed">Veja se está tudo certo antes do envio.</p><div className="mt-5 overflow-hidden border-2 border-slate-900 rounded-xl text-left text-xs bg-white">{[["Nome", user?.nome, "CPF", user?.cpf], ["Cargo", user?.cargo, "Órgão", user?.orgao], ["Mat. 1º", user?.mat1, "Mat. 2º", user?.mat2 || "-"], ["Unid. 1º", user?.unid1, "Unid. 2º", user?.unid2 || "-"], ["Telefone", user?.tel, "E-mail", user?.email]].map(([a, b, c, d], index) => <div key={index} className="grid grid-cols-2 border-b-2 border-slate-900 last:border-b-0"><div className="p-2 border-r-2 border-slate-900 font-black">{a}: <span className="font-bold text-blue-700">{b}</span></div><div className="p-2 font-black">{c}: <span className="font-bold text-blue-700">{d}</span></div></div>)}<div className="p-2 font-black">Situação: <span className="font-bold text-blue-700">{user?.sit}</span></div></div><div className="bg-blue-50 text-blue-900 border-2 border-blue-200 rounded-2xl p-4 mt-4 text-sm font-bold leading-relaxed"><b>Tipo:</b> {typeLabel}<br /><b>Data:</b> {formatDataLongBR(date)}{shift && <><br /><b>Turno:</b> {shift}</>}{leaveType === "acompanhamento" && <><br /><b>Parentesco:</b> {kinship}</>}</div><button className={`${btnSuccess} mt-5`} onClick={() => go("confirm")}>ESTÁ CORRETO</button><button className={`${btnSecondary} mt-3`} onClick={requestEdit}>SOLICITAR ALTERAÇÃO CADASTRAL<span className="text-sm font-bold text-slate-500">Taxa administrativa R$5,00</span></button></div></div></Shell>; }
  if (screen === "confirm") return <Shell><Topbar small="Passo 4 de 4" title="Enviar" backTo="preview" onBack={go} /><div className="p-5 pt-0 text-center"><div className="bg-white rounded-3xl border-4 border-blue-100 p-6 shadow-sm"><div className="flex justify-center mb-3"><IconFile /></div><h2 className="text-3xl font-black text-slate-900">Tudo pronto!</h2><p className="text-xl text-slate-600 font-bold mt-3 leading-relaxed">O PDF será gerado com formulário, atestado e identidade.</p></div><button className={`${btnSuccess} mt-5 ${isGenerating ? "animate-pulse" : ""}`} onClick={generateAndSharePDF} disabled={isGenerating}>{isGenerating ? "GERANDO PDF..." : <><IconSend /> GERAR E ENVIAR</>}</button></div></Shell>;
  return <Shell><div className="p-5 min-h-screen flex flex-col gap-6 text-center items-center justify-center"><IconCheck /><h1 className="text-4xl font-extrabold text-green-700 leading-tight">Sucesso!</h1><p className="text-2xl text-slate-700 mt-4">O formulário foi enviado automaticamente.</p><button className={`${btnPrimary} mt-10`} onClick={() => { setAtestadoDoc(null); go("home"); }}>FAZER OUTRO</button></div></Shell>;
}
