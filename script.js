import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    addDoc, collection, deleteDoc, doc, getDoc, getDocs,
    getFirestore, onSnapshot, orderBy, query, serverTimestamp,
    setDoc, updateDoc, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================
   Firebase (somente Firestore — sem Auth)
========================================= */
const firebaseConfig = {
    apiKey: "AIzaSyDgaoVZK-5TF5xDFulLISridU9IXbmEYgg",
    authDomain: "barbearia-agenda-fe2a7.firebaseapp.com",
    projectId: "barbearia-agenda-fe2a7",
    storageBucket: "barbearia-agenda-fe2a7.firebasestorage.app",
    messagingSenderId: "876658896099",
    appId: "1:876658896099:web:6a361416ed84fd636f29d6",
    measurementId: "G-NJ4ETW1TNZ"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =========================================
   Globais / DOM
========================================= */
const $ = (s) => document.querySelector(s);
let allClients = [];
let reportCache = [];
let reportsChartInstance = null;

const SERVICES_LIST = [
    { name: 'Sobrancelha', price: 30.00 },
    { name: 'Acabamento ', price: 20.00 },
    { name: 'Maquina e Tesoura', price: 40.00 },
    { name: 'Corte Maquina', price: 40.00 },
    { name: 'Corte Tesoura', price: 50.00 },
    { name: 'Alisamento Americano', price: 50.00 },
    { name: 'Corte Infantil', price: 50.00 },
    { name: 'Blindado', price: 60.00 },
    { name: 'Corte + Barba + Alisamento Prime', price: 150.00 },
    { name: "Outro", price: 0 },
];
const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito"];

const BOOKING_URL = "https://barbearia-vitrine.vercel.app/";

const mainContents = document.querySelectorAll("main");
const tabBtns = document.querySelectorAll(".tab-btn");

const clientForm = $("#clientForm"),
    clientTableBody = $("#clientTableBody"),
    clientSearch = $("#clientSearch"),
    paymentsTableBody = $("#paymentsTableBody"),
    clientTypeSelect = $("#clientType"),
    clientValueField = $("#clientValueField"),
    clientPayDayField = $("#clientPayDayField"),
    saveClientBtn = $("#saveClientBtn"),
    clientNameInput = $("#clientName"),
    clientFilterButtons = document.querySelectorAll(".filter-tab-btn");

const agendaGrid = $("#agenda-grid"),
    profissionalSelect = $("#profissionalSelect"),
    dataFiltro = $("#dataFiltro"),
    horaFiltro = $("#horaFiltro"),
    buscarBtn = $("#buscarBtn"),
    bloquearBtn = $("#bloquearBtn"),
    desbloquearBtn = $("#desbloquearBtn");

const relProf = $("#relProf"),
    relDe = $("#relDe"),
    relAte = $("#relAte"),
    relGerarBtn = $("#relGerarBtn"),
    exportCsv = $("#exportCsv"),
    relDetalheTbody = $("#relDetalheTbody"),
    kpiQtd = $("#kpiQtd"),
    kpiBruto = $("#kpiBruto"),
    kpiTicket = $("#kpiTicket");

/* =========================================
   Helpers
========================================= */
const formatCurrency = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString("pt-BR") : "—";
const ymdToDateStr = (ymd) => new Date(`${ymd}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const showNotification = (message, type = "success") => {
    const container = $("#notification-container"), el = document.createElement("div");
    el.className = `notification ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};

const capitalizeName = (name) => !name ? "" :
    name.trim().toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const formatPhoneNumber = (phone) => {
    if (!phone) return "";
    const d = phone.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return phone;
};

const getCorrectedAppointment = (appointmentData) => {
    const corrected = { ...appointmentData };
    const servicoNome = corrected.servico || "—";
    const servicoValor = corrected.valor || 0;
    if ((!servicoValor || servicoValor === 0) && typeof servicoNome === "string") {
        const m = servicoNome.match(/R\$\s*(\d+[,.]?\d*)/);
        if (m && m[1]) {
            corrected.valor = Number.parseFloat(m[1].replace(",", "."));
            corrected.servico = servicoNome.substring(0, m.index).trim();
        }
    }
    return corrected;
};

/* =========================================
   Modal (sem travas de login)
========================================= */
const mainModal = {
    el: $("#mainModal"),
    title: $("#modalTitle"),
    body: $("#modalBody"),
    footer: $("#modalFooter"),
    show(config) {
        this.title.textContent = config.title || "";
        this.body.innerHTML = config.body || "";
        this.footer.innerHTML = "";
        (config.buttons || []).forEach((b) => {
            const btn = document.createElement("button");
            btn.className = `btn ${b.class || ""}`;
            btn.innerHTML = b.text || "";
            if (b.style) Object.assign(btn.style, b.style);
            btn.onclick = () => {
                if (b.onClick) {
                    const r = b.onClick();
                    if (r === false) return;
                }
                this.hide();
            };
            this.footer.appendChild(btn);
        });
        this.el.classList.add("show");
    },
    hide() {
        this.el.classList.remove("show");
    }
};
$("#modalClose").addEventListener("click", () => mainModal.hide());
mainModal.el.addEventListener("click", (e) => { if (e.target === mainModal.el) mainModal.hide(); });

/* =========================================
   Tabs
========================================= */
const showTab = (tabId) => {
    mainContents.forEach((m) => m.classList.remove("active"));
    $(`#${tabId}Main`).classList.add("active");
    tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
};
tabBtns.forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

/* =========================================
   Clientes
========================================= */
const validateClientForm = () => { saveClientBtn.disabled = clientNameInput.value.trim() === ""; };

const applyClientFilters = () => {
    const s = clientSearch.value.toLowerCase();
    const typeFilter = document.querySelector(".filter-tab-btn.active").dataset.filter;
    const filtered = allClients.filter((c) =>
        (c.name.toLowerCase().includes(s) || (c.phone || "").includes(s)) &&
        (typeFilter === "all" || c.type === typeFilter)
    );
    renderClients(filtered);
};

clientTypeSelect.addEventListener("change", () => {
    const isPlan = clientTypeSelect.value === "plano_jc";
    clientValueField.classList.toggle("hidden-block", !isPlan);
    clientPayDayField.classList.toggle("hidden-block", !isPlan);
});

clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const clientData = {
        name: capitalizeName($("#clientName").value),
        phone: formatPhoneNumber($("#clientPhone").value),
        type: $("#clientType").value,
        value: $("#clientType").value === "plano_jc" ? Number.parseFloat($("#clientValue").value) || 0 : 0,
        payDay: $("#clientType").value === "plano_jc" ? Number.parseInt($("#clientPayDay").value) || null : null,
        status: $("#clientStatus").value,
        createdAt: serverTimestamp(),
    };
    if (!clientData.name) return showNotification("Nome é obrigatório", "error");
    try {
        await addDoc(collection(db, "clientes"), clientData);
        showNotification("Cliente salvo!");
        clientForm.reset();
        clientTypeSelect.dispatchEvent(new Event("change"));
        validateClientForm();
    } catch (err) {
        console.error("[clientes:create]", err);
        showNotification("Erro ao salvar.", "error");
    }
});

const renderClients = (clients) => {
    clientTableBody.innerHTML =
        clients.map((c) => `
      <tr data-client-id="${c.id}" data-client-status="${c.status}" data-client-type="${c.type}">
        <td data-label="Nome"><strong>${c.name}</strong><br><small style="color:var(--text-light)">${c.type === "plano_jc" ? `Plano: ${formatCurrency(c.value)} / Dia ${c.payDay || "N/A"}` : "Avulso"}</small></td>
        <td data-label="Telefone">${c.phone || "—"}</td>
        <td data-label="Tipo">${c.type === "plano_jc" ? "Plano JC" : "Avulso"}</td>
        <td data-label="Status"><span class="badge ${c.status}">${c.status}</span></td>
        <td data-label="Ações">
          <div class="actions">
            <button class="btn btn-sm btn-edit" data-action="edit"><i class='bx bx-edit'></i></button>
            <button class="btn btn-sm ${c.status === "ativo" ? "btn-warning" : "btn-success"}" data-action="toggle-status"><i class='bx ${c.status === "ativo" ? "bx-pause" : "bx-play"}'></i></button>
            ${c.type === "plano_jc" && c.status === "ativo" ? `<button class="btn btn-sm btn-success" data-action="pay"><i class='bx bx-dollar'></i></button>` : ""}
            ${c.type === "cliente" ? `<button class="btn btn-sm btn-del" data-action="delete"><i class='bx bx-trash'></i></button>` : ""}
          </div>
        </td>
      </tr>`).join("")
        || `<tr><td colspan="5" class="loading-row">${allClients.length > 0 ? "Nenhum cliente encontrado." : "Carregando..."}</td></tr>`;
};

clientSearch.addEventListener("input", applyClientFilters);
clientFilterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        clientFilterButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyClientFilters();
    });
});

const updateClientKPIs = () => {
    const activePlanMembers = allClients.filter((c) => c.type === "plano_jc" && c.status === "ativo");
    $("#activeMembers").textContent = activePlanMembers.length;
    $("#estimatedRevenue").textContent = formatCurrency(activePlanMembers.reduce((s, c) => s + c.value, 0));
};

/* =========================================
   ==== Helpers Agenda ====
========================================= */
const normalize = (s) => (s || "").toString().trim().toLowerCase();
const sameProf = (a, b) => normalize(a) === normalize(b);

const startOfDayFromYmd = (ymd) => new Date(`${ymd}T00:00:00.000`);
const endOfDayFromYmd = (ymd) => new Date(`${ymd}T23:59:59.999`);

async function fetchAppointmentsSmart(ymd, prof) {
    const col = collection(db, "agendamentos");
    const profFields = ["profissional", "prof", "barbeiro"];
    const dateStrFlds = ["dataISO", "dateISO", "dia"];
    const dateTsFlds = ["data", "when", "date"];

    for (const df of dateStrFlds) {
        for (const pf of profFields) {
            try {
                const q1 = query(col, where(df, "==", ymd), where(pf, "==", prof));
                const s1 = await getDocs(q1);
                if (!s1.empty) return s1.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (_) { }
        }
    }
    for (const tf of dateTsFlds) {
        for (const pf of profFields) {
            try {
                const start = startOfDayFromYmd(ymd);
                const end = endOfDayFromYmd(ymd);
                const q2 = query(col, where(tf, ">=", start), where(tf, "<=", end), where(pf, "==", prof));
                const s2 = await getDocs(q2);
                if (!s2.empty) return s2.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (_) { }
        }
    }
    for (const df of dateStrFlds) {
        try {
            const q3 = query(col, where(df, "==", ymd));
            const s3 = await getDocs(q3);
            if (!s3.empty) {
                const all = s3.docs.map(d => ({ id: d.id, ...d.data() }));
                const filtered = all.filter(a => sameProf(a.profissional || a.prof || a.barbeiro, prof));
                if (filtered.length) return filtered;
            }
        } catch (_) { }
    }
    for (const tf of dateTsFlds) {
        try {
            const start = startOfDayFromYmd(ymd);
            const end = endOfDayFromYmd(ymd);
            const q4 = query(col, where(tf, ">=", start), where(tf, "<=", end));
            const s4 = await getDocs(q4);
            if (!s4.empty) {
                const all = s4.docs.map(d => ({ id: d.id, ...d.data() }));
                const filtered = all.filter(a => sameProf(a.profissional || a.prof || a.barbeiro, prof));
                if (filtered.length) return filtered;
            }
        } catch (_) { }
    }
    return [];
}

// normaliza o campo de hora para HH:MM
const getHourKey = (a) => {
    const raw = a.hora || a.time || a.horario || "";
    const m = String(raw).match(/^\s*(\d{1,2}):?(\d{2})\s*$/);
    if (!m) return String(raw) || "";
    const H = m[1].padStart(2, "0");
    const M = m[2];
    return `${H}:${M}`;
};

/* =========================================
   Agenda
========================================= */
const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

// comparador para manter a ordem da grade padrão
const timeOrder = (a, b) => {
    const ia = HOURS.indexOf(a);
    const ib = HOURS.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
};

const buscarAgenda = async () => {
    const ymd = dataFiltro.value;
    const prof = profissionalSelect.value;
    if (!ymd || !prof) return;

    agendaGrid.innerHTML = `
    <div class="loading-row" style="background:var(--white); border-radius:12px; border:1px solid var(--border);">
      Buscando agendamentos...
    </div>`;

    try {
        const results = await fetchAppointmentsSmart(ymd, prof);

        // Índice por horário
        const byTime = {};
        for (const r of results) {
            const h = getHourKey(r) || "—";
            (byTime[h] ||= []).push(r);
        }

        // >>>> sempre mostrar todos os horários livres + os registrados
        const times = Object.keys(byTime);
        const baseHours = Array.from(new Set([...HOURS, ...times])).sort(timeOrder);

        const timeslotsHTML = baseHours.map((hour) => {
            const appointments = byTime[hour] || [];
            const isBlocked = appointments.some((a) => a.bloqueado);

            let content = `<div class="timeslot-empty" data-action="schedule" data-time="${hour}">
                       + Agendar Horário
                     </div>`;

            if (isBlocked) {
                content = `<div class="timeslot-empty" style="cursor:not-allowed; color: var(--text-light); background: transparent; border-style: solid;">
                     <strong>Horário Bloqueado</strong>
                   </div>`;
            } else if (appointments.length > 0) {
                content = appointments.map((r) => {
                    const corr = getCorrectedAppointment(r);
                    const valorDisplay = formatCurrency(corr.valor);
                    const warn = (!corr.valor || corr.valor === 0)
                        ? `<i class='bx bxs-error-circle' style="color:var(--warning); vertical-align: middle; margin-left: 4px;" title="Agendamento sem valor definido na origem."></i>`
                        : "";
                    return `
          <div class="appointment-card">
            <div class="appointment-info">
              <strong>${corr.clienteNome || r.cliente || "—"}</strong><br>
              <span>${corr.servico || "—"} (${valorDisplay})${warn}</span>
            </div>
            <div class="actions">
              <button class="btn btn-sm btn-edit" data-action="edit-agenda" data-id="${r.id}"><i class='bx bx-edit'></i></button>
              <button class="btn btn-sm btn-del" data-action="cancel-agenda" data-id="${r.id}"><i class='bx bx-trash'></i></button>
            </div>
          </div>`;
                }).join("");
            }

            return `<div class="timeslot ${isBlocked ? "blocked-slot" : ""}">
                <div class="timeslot-time">${hour}</div>
                <div class="timeslot-content">${content}</div>
              </div>`;
        }).join("");

        const bookingFooter = `
      <div class="card" style="margin-top:16px;border:1px dashed var(--border);background:#fff;padding:12px;border-radius:12px;">
        <div style="display:flex;justify-content:flex-start">
          <button id="openBookingModal" class="btn" style="display:inline-flex;gap:8px;align-items:center">
            <i class='bx bx-calendar-event'></i> Ir para Agendamentos
          </button>
        </div>
      </div>`;

        agendaGrid.innerHTML = timeslotsHTML + bookingFooter;
    } catch (err) {
        console.error("Erro na busca da agenda:", err);
        agendaGrid.innerHTML = `<div class="loading-row">Erro ao carregar agenda. Verifique as permissões do Firestore.</div>`;
    }
};

/* ====== Editar / Novo / Cancelar Agendamento ====== */
const openEditAgendaModal = async (id) => {
    const ref = doc(db, "agendamentos", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) { showNotification("Agendamento não encontrado.", "error"); return; }
    const data = getCorrectedAppointment(snap.data());

    const hoursOptions = HOURS.map((h) => `<option value="${h}" ${h === data.hora ? "selected" : ""}>${h}</option>`).join("");
    const currentMethod = (data.pagamentoForma ?? data.formaPagamento ?? "");
    const paymentMethodOptions = PAYMENT_METHODS.map((p) => `<option value="${p}" ${p === currentMethod ? "selected" : ""}>${p}</option>`).join("");

    mainModal.show({
        title: "Editar Agendamento",
        body: `<div class="form-grid">
      <div class="field"><label>Cliente</label><input id="modalEditCliente" value="${data.clienteNome || data.cliente || ""}"></div>
      <div class="form-row">
        <div class="field"><label>Data</label><input type="date" id="modalEditDate" value="${data.dataISO || ""}"></div>
        <div class="field"><label>Hora</label><select id="modalEditTime">${hoursOptions}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Valor (R$)</label><input type="number" id="modalEditValor" value="${data.valor || 0}" step="0.01"></div>
        <div class="field"><label>Forma de Pagamento</label><select id="modalEditPaymentMethod">${paymentMethodOptions}</select></div>
      </div>
    </div>`,
        buttons: [
            { text: "Cancelar", class: "btn-light" },
            {
                text: "Salvar", class: "btn-primary",
                onClick: async () => {
                    const updatedData = {
                        clienteNome: capitalizeName($("#modalEditCliente").value),
                        dataISO: $("#modalEditDate").value,
                        hora: $("#modalEditTime").value,
                        valor: Number.parseFloat($("#modalEditValor").value) || 0,
                        pagamentoForma: $("#modalEditPaymentMethod").value,
                    };
                    try { await updateDoc(ref, updatedData); showNotification("Agendamento atualizado!"); buscarAgenda(); }
                    catch (err) { console.error("[agendamentos:update]", err); showNotification("Erro ao atualizar.", "error"); return false; }
                }
            }
        ]
    });
};

const openNewAgendaModal = (time) => {
    const prof = profissionalSelect.value;
    const clientsDatalist = allClients.map((c) => `<option value="${c.name}"></option>`).join("");
    const servicesOptions = SERVICES_LIST.map((s) => `<option value="${s.name}" data-price="${s.price}">${s.name}</option>`).join("");

    mainModal.show({
        title: `Novo Agendamento - ${time}`,
        body: `<div class="form-grid">
      <div class="field"><label>Cliente</label><input id="modalNewCliente" list="clients-datalist" placeholder="Digite ou selecione um cliente"><datalist id="clients-datalist">${clientsDatalist}</datalist></div>
      <div class="field"><label>Serviço</label><select id="modalNewServico"><option value="" data-price="0">Selecione um serviço</option>${servicesOptions}</select></div>
      <div class="field"><label>Valor (R$)</label><input type="number" id="modalNewValor" placeholder="0.00"></div>
    </div>`,
        buttons: [
            { text: "Cancelar", class: "btn-light" },
            {
                text: "Salvar Agendamento", class: "btn-primary",
                onClick: async () => {
                    const serviceSelect = $("#modalNewServico");
                    const newAppointment = {
                        clienteNome: capitalizeName($("#modalNewCliente").value),
                        servico: serviceSelect.value,
                        valor: Number.parseFloat($("#modalNewValor").value) || 0,
                        hora: time,
                        dataISO: dataFiltro.value,
                        profissional: prof,
                        // bloqueado: false,  // REMOVIDO para atender às regras
                        pagamentoForma: "",
                        createdAt: serverTimestamp(),
                    };
                    if (!newAppointment.clienteNome || !newAppointment.servico) {
                        showNotification("Cliente e serviço são obrigatórios.", "error");
                        return false;
                    }
                    try {
                        await addDoc(collection(db, "agendamentos"), newAppointment);
                        showNotification("Agendamento criado com sucesso!");
                        buscarAgenda();
                    } catch (err) {
                        console.error("[agendamentos:create]", err);
                        showNotification(`Erro ao criar agendamento.`, "error");
                    }
                }
            }
        ]
    });

    const serviceSelect = document.getElementById("modalNewServico");
    const valueInput = document.getElementById("modalNewValor");
    serviceSelect.addEventListener("change", () => {
        const price = serviceSelect.options[serviceSelect.selectedIndex].dataset.price;
        valueInput.value = price > 0 ? Number.parseFloat(price).toFixed(2) : "";
    });
};

const cancelarAgendamento = (id) => mainModal.show({
    title: "Cancelar Agendamento",
    body: `<p>Tem certeza que deseja cancelar/remover este item?</p>`,
    buttons: [
        { text: "Fechar", class: "btn-light" },
        {
            text: "Confirmar", class: "btn-del",
            onClick: async () => {
                try { await deleteDoc(doc(db, "agendamentos", id)); showNotification("Agendamento cancelado."); buscarAgenda(); }
                catch (err) { console.error("[agendamentos:delete]", err); showNotification("Erro ao cancelar.", "error"); }
            }
        }
    ]
});

agendaGrid.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const { action, id, time } = target.dataset;
    if (action === "edit-agenda") openEditAgendaModal(id);
    if (action === "cancel-agenda") cancelarAgendamento(id);
    if (action === "schedule") openNewAgendaModal(time);
});

agendaGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("#openBookingModal");
    if (!btn) return;
    mainModal.show({
        title: "Ir para Agendamentos",
        body: `
      <p>Escolha como deseja abrir a página de agendamentos.</p>
      <div style="margin-top:12px;padding:10px;border:1px solid var(--border,#e5e7eb);border-radius:10px;background:#fff;">
        <div style="font-size:.88rem;color:var(--text-light,#6b7280);margin-bottom:4px">Endereço</div>
        <a href="${BOOKING_URL}" target="_blank" rel="noopener" style="word-break:break-all">${BOOKING_URL}</a>
      </div>
    `,
        buttons: [
            { text: "Cancelar", class: "btn-light" },
            { text: "<i class='bx bx-link-external'></i> Abrir em nova aba", class: "btn", onClick: () => { window.open(BOOKING_URL, "_blank", "noopener"); } },
            {
                text: "<i class='bx bx-copy'></i> Copiar link",
                class: "btn-light",
                onClick: async () => {
                    try { await navigator.clipboard.writeText(BOOKING_URL); }
                    catch {
                        const ta = document.createElement("textarea");
                        ta.value = BOOKING_URL; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
                    }
                    showNotification("Link copiado!");
                    return false;
                }
            }
        ]
    });
});

/* ===== Bloquear / Desbloquear ===== */
bloquearBtn.addEventListener("click", async () => {
    const prof = profissionalSelect.value, ymd = dataFiltro.value;
    const qSnap = await getDocs(query(collection(db, "agendamentos"), where("dataISO", "==", ymd), where("profissional", "==", prof)));
    const occupiedHours = qSnap.docs.map((d) => d.data().hora);

    let body = `
    <div class="block-hours-controls">
      <button class="btn btn-sm btn-primary" id="selectAllHoursBtn">Selecionar Todos</button>
      <button class="btn btn-sm btn-light" id="clearAllHoursBtn">Limpar Seleção</button>
    </div>
    <div class="block-hours-grid">`;
    HOURS.forEach((h) => { const dis = occupiedHours.includes(h) ? "disabled" : ""; body += `<button class="hour-toggle-btn" data-hour="${h}" ${dis}>${h}</button>`; });
    body += "</div>";

    mainModal.show({
        title: "Desativar Horários",
        body,
        buttons: [
            { text: "Cancelar", class: "btn-light" },
            {
                text: "Confirmar Desativação", class: "btn-del",
                onClick: async () => {
                    const selected = Array.from(document.querySelectorAll(".hour-toggle-btn.selected")).map((b) => b.dataset.hour);
                    if (!selected.length) { showNotification("Nenhum horário selecionado.", "error"); return false; }
                    for (const h of selected) {
                        const id = `block_${prof.replace(/\s+/g, "_")}_${ymd}_${h}`;
                        await setDoc(doc(db, "agendamentos", id), { dataISO: ymd, hora: h, profissional: prof, bloqueado: true, createdAt: serverTimestamp() });
                    }
                    showNotification(`${selected.length} horário(s) desativado(s).`);
                    buscarAgenda();
                }
            }
        ]
    });

    $("#selectAllHoursBtn").addEventListener("click", () => { document.querySelectorAll(".hour-toggle-btn:not(:disabled)").forEach((b) => b.classList.add("selected")); });
    $("#clearAllHoursBtn").addEventListener("click", () => { document.querySelectorAll(".hour-toggle-btn.selected").forEach((b) => b.classList.remove("selected")); });
    document.querySelector(".block-hours-grid").addEventListener("click", (e) => {
        if (e.target.classList.contains("hour-toggle-btn") && !e.target.disabled) e.target.classList.toggle("selected");
    });
});

desbloquearBtn.addEventListener("click", async () => {
    const prof = profissionalSelect.value, ymd = dataFiltro.value, hh = horaFiltro.value;
    let qBase = query(collection(db, "agendamentos"), where("dataISO", "==", ymd), where("profissional", "==", prof), where("bloqueado", "==", true));
    if (hh) qBase = query(qBase, where("hora", "==", hh));
    const snap = await getDocs(qBase);
    for (const d of snap.docs) { await deleteDoc(d.ref); }
    if (snap.docs.length > 0) showNotification(`${snap.docs.length} horário(s) reativado(s).`);
    buscarAgenda();
});

/* =========================================
   Relatórios
========================================= */
const renderReportChart = (data) => {
    const ctx = document.getElementById("reportsChart").getContext("2d");
    const revenueByService = new Map();
    data.forEach((i) => {
        const s = i.servico || "Não especificado";
        revenueByService.set(s, (revenueByService.get(s) || 0) + (Number(i.valor) || 0));
    });
    const labels = [...revenueByService.keys()];
    const values = [...revenueByService.values()];

    if (reportsChartInstance) reportsChartInstance.destroy();
    const legendContainer = document.getElementById("reportsChartLegend"); legendContainer.innerHTML = "";

    // eslint-disable-next-line no-undef
    reportsChartInstance = new Chart(ctx, {
        type: "pie",
        data: { labels, datasets: [{ label: "Faturamento", data: values, backgroundColor: ["#374151", "#6D5D6E", "#929AAB", "#e5e7eb", "#ef4444", "#f59e0b", "#10b981", "#3b82f6"], hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: true, plugins: {
                legend: { display: false }, tooltip: {
                    callbacks: {
                        label: (c) => {
                            const label = c.label || ""; const v = c.parsed || 0;
                            const total = c.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const p = total > 0 ? ((v / total) * 100).toFixed(1) + "%" : "0%";
                            return `${label}: ${formatCurrency(v)} (${p})`;
                        }
                    }
                }
            }
        }
    });

    reportsChartInstance.data.labels.forEach((label, idx) => {
        const color = reportsChartInstance.data.datasets[0].backgroundColor[idx % reportsChartInstance.data.datasets[0].backgroundColor.length];
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `<span class="legend-color-box" style="background-color:${color}"></span><span>${label}</span>`;
        legendContainer.appendChild(item);
    });
};

relGerarBtn.addEventListener("click", async () => {
    const de = relDe.value, ate = relAte.value, prof = relProf.value;
    if (!de || !ate || !prof) return showNotification("Preencha todos os filtros.", "error");
    relDetalheTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Gerando...</td></tr>`;
    const q = query(collection(db, "agendamentos"), where("dataISO", ">=", de), where("dataISO", "<=", ate));
    try {
        reportCache = (await getDocs(q)).docs
            .map((d) => getCorrectedAppointment({ ...d.data() }))
            .filter((d) => !d.bloqueado && (d.profissional === prof))
            .map(d => ({ ...d, pagamentoForma: (d.pagamentoForma ?? d.formaPagamento ?? "—") }));

        reportCache.sort((a, b) => (a.dataISO + (a.hora || "")).localeCompare(b.dataISO + (b.hora || "")));
        const qtd = reportCache.length;
        const bruto = reportCache.reduce((s, it) => s + (Number(it.valor) || 0), 0);
        const ticket = qtd ? bruto / qtd : 0;
        kpiQtd.textContent = qtd; kpiBruto.textContent = formatCurrency(bruto); kpiTicket.textContent = formatCurrency(ticket);

        relDetalheTbody.innerHTML =
            reportCache.length === 0
                ? `<tr><td colspan="6" class="loading-row">Nenhum resultado.</td></tr>`
                : reportCache.map((r) => `
          <tr>
            <td data-label="Data">${ymdToDateStr(r.dataISO)}</td>
            <td data-label="Profissional">${r.profissional || "—"}</td>
            <td data-label="Cliente">${r.clienteNome || r.cliente || "—"}</td>
            <td data-label="Serviço">${r.servico || "—"}</td>
            <td data-label="Forma">${r.pagamentoForma || "—"}</td>
            <td data-label="Valor">${formatCurrency(r.valor)}</td>
          </tr>`).join("");

        renderReportChart(reportCache);
    } catch (err) {
        console.error("Erro ao gerar relatório: ", err);
        relDetalheTbody.innerHTML = `<tr><td colspan="6" class="loading-row">Erro ao gerar relatório. Verifique o console.</td></tr>`;
    }
});

exportCsv.addEventListener("click", () => {
    if (reportCache.length === 0) return showNotification("Gere um relatório primeiro.", "error");
    const headers = ["Data", "Profissional", "Cliente", "Serviço", "Forma", "Valor"];
    const rows = reportCache.map((r) => [
        ymdToDateStr(r.dataISO),
        r.profissional || "",
        r.clienteNome || r.cliente || "",
        r.servico || "",
        (r.pagamentoForma || "—"),
        (Number(r.valor) || 0).toFixed(2).replace(".", ","),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8,\uFEFF" + encodeURI(csv);
    link.download = `relatorio_${relDe.value}_a_${relAte.value}.csv`;
    link.click();
});

/* =========================================
   Init (sem auth gate)
========================================= */
const init = async () => {
    const hoje = new Date().toISOString().split("T")[0];
    dataFiltro.value = hoje;
    relDe.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
    relAte.value = hoje;

    const profOptions = '<option value="barbeiro">Barbeiro</option>';
    profissionalSelect.innerHTML = profOptions;
    relProf.innerHTML = profOptions;

    horaFiltro.innerHTML += HOURS.map((h) => `<option>${h}</option>`).join("");

    buscarBtn.addEventListener("click", buscarAgenda);
    clientNameInput.addEventListener("input", validateClientForm);

    onSnapshot(
        query(collection(db, "clientes"), orderBy("name")),
        (snap) => { allClients = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })); applyClientFilters(); updateClientKPIs(); },
        (error) => console.error("Erro no listener de clientes:", error)
    );
    onSnapshot(
        query(collection(db, "pagamentos"), orderBy("date", "desc")),
        (snap) => { renderPayments(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))); },
        (error) => console.error("Erro no listener de pagamentos:", error)
    );

    showTab("agenda");
    clientTypeSelect.dispatchEvent(new Event("change"));
    buscarAgenda();
    validateClientForm();
};

const renderPayments = (payments) => {
    const monthly = payments.filter((p) => p.date && p.date.toDate() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    paymentsTableBody.innerHTML =
        monthly.map((p) => `
      <tr>
        <td data-label="Data">${formatDate(p.date)}</td>
        <td data-label="Cliente">${p.clientName}</td>
        <td data-label="Valor">${formatCurrency(p.value)}</td>
        <td data-label="Ações"><button class="btn btn-sm btn-del" data-payment-id="${p.id}"><i class='bx bx-trash'></i></button></td>
      </tr>`).join("")
        || `<tr><td colspan="4" class="loading-row">Nenhum pagamento este mês.</td></tr>`;
    $("#monthlyTotal").textContent = formatCurrency(monthly.reduce((s, p) => s + p.value, 0));
};

paymentsTableBody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-payment-id]");
    if (button) {
        const id = button.dataset.paymentId;
        mainModal.show({
            title: "Remover Pagamento",
            body: `<p>Deseja remover este registro?</p>`,
            buttons: [
                { text: "Cancelar", class: "btn-light" },
                {
                    text: "Confirmar", class: "btn-del",
                    onClick: async () => {
                        try { await deleteDoc(doc(db, "pagamentos", id)); showNotification("Pagamento removido!"); }
                        catch (err) { console.error("[pagamentos:delete]", err); showNotification("Erro ao remover.", "error"); }
                    }
                }
            ]
        });
    }
});

/* Boot */
document.addEventListener("DOMContentLoaded", init);






// === Editar cliente (modal)
const openEditClientModal = (id) => {
    const client = allClients.find((c) => c.id === id);
    if (!client) return;

    const modalButtons = [];
    if (client.type === "plano_jc") {
        modalButtons.push({
            text: '<i class="bx bx-trash"></i> Excluir',
            class: "btn-danger",
            style: { marginRight: "auto" },
            onClick: () => { handleClientActions("delete", id, client.status, client.type); return false; }
        });
    }
    modalButtons.push({ text: "Cancelar", class: "btn-light" });
    modalButtons.push({
        text: "Salvar", class: "btn-primary",
        onClick: async () => {
            const data = {
                phone: formatPhoneNumber($("#modalEditPhone").value),
                ...(client.type === "plano_jc" && {
                    value: Number.parseFloat($("#modalEditValue").value) || 0,
                    payDay: Number.parseInt($("#modalEditPayDay").value) || null,
                }),
            };
            try {
                await updateDoc(doc(db, "clientes", id), data);
                showNotification("Cliente atualizado!");
            } catch (e) {
                console.error("[clientes:update]", e);
                showNotification("Erro ao atualizar.", "error");
                return false;
            }
        }
    });

    mainModal.show({
        title: "Editar Cliente",
        body: `<div class="form-grid">
      <div class="field"><label>Nome</label><input type="text" value="${client.name}" readonly></div>
      <div class="field"><label>Telefone</label><input type="tel" id="modalEditPhone" value="${client.phone || ""}" maxlength="15"></div>
      ${client.type === "plano_jc" ? `
        <div class="field"><label>Valor Mensal (R$)</label><input type="number" id="modalEditValue" value="${client.value || 0}" step="0.01"></div>
        <div class="field"><label>Dia Pgto.</label><input type="number" id="modalEditPayDay" value="${client.payDay || ""}"></div>
      ` : ""}
    </div>`,
        buttons: modalButtons,
    });
};

// === Ações dos botões
const handleClientActions = (action, id, status, type) => {
    switch (action) {
        case "edit":
            openEditClientModal(id);
            break;

        case "toggle-status":
            mainModal.show({
                title: "Confirmar",
                body: `<p>Deseja ${status === "ativo" ? "desativar" : "ativar"} este cliente?</p>`,
                buttons: [
                    { text: "Cancelar", class: "btn-light" },
                    {
                        text: "Confirmar", class: "btn-primary",
                        onClick: async () => {
                            try {
                                await updateDoc(doc(db, "clientes", id), { status: status === "ativo" ? "inativo" : "ativo" });
                                showNotification("Status alterado!");
                            } catch (e) {
                                console.error("[clientes:toggle-status]", e);
                                showNotification("Erro ao alterar.", "error");
                                return false;
                            }
                        }
                    }
                ]
            });
            break;

        case "delete":
            mainModal.show({
                title: "Excluir Cliente",
                body: `<p>Atenção: Ação irreversível. Deseja excluir este cliente?</p>`,
                buttons: [
                    { text: "Cancelar", class: "btn-light" },
                    {
                        text: "Confirmar Exclusão", class: "btn-del",
                        onClick: async () => {
                            try {
                                await deleteDoc(doc(db, "clientes", id));
                                showNotification("Cliente excluído!");
                            } catch (e) {
                                console.error("[clientes:delete]", e);
                                showNotification("Erro ao excluir.", "error");
                                return false;
                            }
                        }
                    }
                ]
            });
            break;

        case "pay":
            if (type !== "plano_jc") return; // botão nem aparece para 'cliente' avulso
            const client = allClients.find((c) => c.id === id);
            if (!client) return;
            mainModal.show({
                title: "Registrar Pagamento",
                body: `<p>Registrar para <strong>${client.name}</strong> o valor de <strong>${formatCurrency(client.value)}</strong>.</p>
               <div class="field" style="margin-top:16px;">
                 <label>Forma de Pagamento</label>
                 <input type="text" id="paymentMethod" value="PIX">
               </div>`,
                buttons: [
                    { text: "Cancelar", class: "btn-light" },
                    {
                        text: "Confirmar", class: "btn-success",
                        onClick: async () => {
                            const method = $("#paymentMethod").value.trim();
                            if (!method) { showNotification("Forma de pagamento obrigatória", "error"); return false; }
                            try {
                                await addDoc(collection(db, "pagamentos"), {
                                    clientId: id,
                                    clientName: client.name,
                                    value: client.value,
                                    method,
                                    date: serverTimestamp()
                                });
                                showNotification("Pagamento registrado!");
                            } catch (e) {
                                console.error("[pagamentos:create]", e);
                                showNotification("Erro ao registrar.", "error");
                                return false;
                            }
                        }
                    }
                ]
            });
            break;
    }
};

// === Delegação de clique na tabela de clientes
clientTableBody.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const row = button.closest("tr");
    handleClientActions(
        button.dataset.action,
        row.dataset.clientId,
        row.dataset.clientStatus,
        row.dataset.clientType
    );
});
