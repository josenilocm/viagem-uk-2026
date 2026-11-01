(() => {
  "use strict";

  const state = {
    data: null,
    view: window.location.hash.slice(1) || "home",
    selectedDate: null,
    itineraryFilter: "all",
    mapCity: "all",
    mapDay: "all",
    completed: loadCompletedTasks(),
  };
  const publicViews = new Set(["home", "itinerary", "map", "tasks", "more"]);
  const statusLabels = {
    confirmed: "Confirmado",
    recorded: "Registrado",
    planned: "Planejado",
    pending: "Pendente",
    suggestion: "Sugestão",
    conflict: "Conflito de horário",
    choice: "Escolha",
  };

  const appContent = document.querySelector("#app-content");
  const loading = document.querySelector("#loading");
  const statusElement = document.querySelector("#connection-status");
  const detailDialog = document.querySelector("#detail-dialog");
  const detailContent = document.querySelector("#detail-content");

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[character]));
  }

  function loadCompletedTasks() {
    try {
      return JSON.parse(localStorage.getItem("trip-public-tasks-v1") || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveCompletedTasks() {
    try { localStorage.setItem("trip-public-tasks-v1", JSON.stringify(state.completed)); } catch (_) { /* storage may be disabled */ }
  }

  function parseDate(date) { return new Date(`${date}T12:00:00`); }

  function formatDate(date, options = { day: "numeric", month: "short" }) {
    return new Intl.DateTimeFormat("pt-BR", options).format(parseDate(date));
  }

  function formatLongDate(date) {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(parseDate(date));
  }

  function todayKeyInTripTimezone() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: state.data.trip.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date()).reduce((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function dateForToday() {
    const dates = state.data.days.map((day) => day.date);
    const todayKey = todayKeyInTripTimezone();
    return dates.find((date) => date >= todayKey) || dates[dates.length - 1];
  }

  function currentDay() {
    return state.data.days.find((day) => day.date === state.selectedDate) || state.data.days[0];
  }

  function allItems() { return state.data.days.flatMap((day) => day.items.map((item) => ({ ...item, date: day.date, city: day.city }))); }

  function statusBadge(item) {
    const label = item.statusLabel || statusLabels[item.status] || "Estado não informado";
    return `<span class="badge ${escapeHTML(item.status)}">${escapeHTML(label)}</span>`;
  }

  function categoryLabel(category) {
    return ({ transporte: "Transporte", cultura: "Cultura", teatro: "Teatro", comida: "Comida", passeio: "Passeio", noite: "Noite", hospedagem: "Hospedagem", compras: "Compras", retorno: "Retorno" }[category] || category || "Roteiro");
  }

  function routeUrl(query) { return `https://maps.apple.com/?q=${encodeURIComponent(query || "Londres")}`; }
  function routeButton(item, extraClass = "") { return `<a class="button button-secondary button-small ${extraClass}" href="${routeUrl(item.mapQuery || item.address)}" target="_blank" rel="noopener noreferrer">Abrir rota <span aria-hidden="true">↗</span></a>`; }

  function actionButton(label, action, value, className = "button button-secondary button-small") {
    return `<button class="${className}" type="button" data-action="${escapeHTML(action)}" data-value="${escapeHTML(value || "")}">${escapeHTML(label)}</button>`;
  }

  function itemCard(item, date = item.date) {
    const itemDate = date ? `<span>${escapeHTML(formatDate(date))}</span>` : "";
    return `<article class="timeline-item">
      <div class="timeline-time">${escapeHTML(item.start === "flex" ? "Flexível" : item.start)}</div>
      <div class="timeline-card">
        <div class="item-meta"><span class="eyebrow">${escapeHTML(categoryLabel(item.category))}</span>${statusBadge(item)}</div>
        <h3>${escapeHTML(item.title)}</h3>
        <p class="item-place">${escapeHTML(item.place)}${itemDate ? ` · ${itemDate}` : ""}</p>
        <p class="item-summary">${escapeHTML(item.summary)}</p>
        <div class="button-row">
          ${routeButton(item)}
          ${actionButton("Detalhes", "detail", item.id)}
        </div>
      </div>
    </article>`;
  }

  function renderHome() {
    const day = currentDay();
    const alerts = state.data.alerts.filter((alert) => alert.date === day.date);
    const visibleAlerts = alerts.length ? alerts : state.data.alerts.filter((alert) => alert.severity === "critical").slice(0, 1);
    const nextItem = day.items.find((item) => item.start !== "flex") || day.items[0];
    const bands = day.items.filter((item) => item !== nextItem).slice(0, 3);
    const taskCount = state.data.tasks.filter((task) => !state.completed[task.id]).length;
    return `<section class="hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHTML(state.data.trip.subtitle)}</p>
        <h2 id="home-title">${escapeHTML(day.city)}</h2>
        <div class="date-line"><strong>${escapeHTML(formatLongDate(day.date))}</strong><span>${escapeHTML(day.base)}</span></div>
        <p>${escapeHTML(day.summary)}</p>
      </div>
      <aside class="hero-note"><strong>Página pública</strong><p>${escapeHTML(state.data.trip.notice)}</p></aside>
    </section>
    <div class="section-heading"><div><h2>Hoje</h2><p>O próximo passo sem procurar demais.</p></div>${actionButton("Ver o roteiro", "set-view", "itinerary", "button button-secondary button-small")}</div>
    ${visibleAlerts.map(renderAlert).join("")}
    <section class="card next-card" aria-labelledby="next-title"><div class="card-pad">
      <p class="eyebrow" id="next-title">Próximo</p><div class="next-time">${escapeHTML(nextItem.start === "flex" ? "Flexível" : nextItem.start)}</div>
      <h3>${escapeHTML(nextItem.title)}</h3><p class="next-meta">${escapeHTML(nextItem.place)} · ${escapeHTML(categoryLabel(nextItem.category))}</p>
      <div class="button-row">${routeButton(nextItem)}${actionButton("Ver detalhes", "detail", nextItem.id)}${actionButton("Marcar como feito", "toggle-item", nextItem.id, "button button-quiet button-small")}</div>
    </div></section>
    <section aria-labelledby="day-flow-title"><div class="section-heading"><div><h2 id="day-flow-title">Agora · depois · no fim do dia</h2><p>Sem esconder o que ainda é apenas plano.</p></div></div>
      <div class="time-strip">${(bands.length ? bands : [{start:"—",title:"Nenhum outro item",summary:"Consulte o roteiro completo."}]).map((item) => `<div class="time-slot"><strong>${escapeHTML(item.start === "flex" ? "Flexível" : item.start)}</strong><span>${escapeHTML(item.title)}</span><small>${escapeHTML(item.summary || "")}</small></div>`).join("")}</div>
    </section>
    <section aria-label="Atalhos" class="quick-actions" style="margin-top:14px">${actionButton("Abrir mapa", "set-view", "map", "quick-action")}<button class="quick-action" type="button" data-action="set-view" data-value="tasks">Ver pendências <small>${taskCount} abertas</small></button></section>
    <section class="section-heading"><div><h2>Resumo do dia</h2><p>${day.items.length} item(ns) · ${alerts.length} alerta(s) · ${taskCount} pendência(s) geral(is)</p></div></section>`;
  }

  function renderAlert(alert) {
    const label = alert.severity === "critical" ? "Atenção" : alert.severity === "attention" ? "Pendência" : "Informativo";
    return `<article class="alert ${escapeHTML(alert.severity)}" role="${alert.severity === "critical" ? "alert" : "region"}"><div class="alert-header"><strong>${label}</strong><span class="badge ${alert.severity === "critical" ? "conflict" : alert.severity === "attention" ? "pending" : "planned"}">${escapeHTML(formatDate(alert.date))}</span></div><h3>${escapeHTML(alert.title)}</h3><p>${escapeHTML(alert.body)}</p><div class="button-row">${actionButton("Ver no roteiro", "select-date", alert.date, "button button-secondary button-small")}${actionButton("Ver tarefas", "set-view", "tasks", "button button-quiet button-small")}</div></article>`;
  }

  function renderDatePicker() {
    return `<div class="date-picker" aria-label="Escolha uma data">${state.data.days.map((day) => `<button type="button" class="date-chip ${day.date === state.selectedDate ? "is-selected" : ""}" data-action="select-date" data-value="${day.date}" aria-pressed="${day.date === state.selectedDate}"><strong>${day.date.slice(8)}</strong><span>${escapeHTML(day.weekday)} · ${escapeHTML(day.city.split(" → ")[0])}</span></button>`).join("")}</div>`;
  }

  function renderItinerary() {
    const day = currentDay();
    const filters = [{ id: "all", label: "Todos" }, { id: "confirmed", label: "Confirmados" }, { id: "pending", label: "Pendentes" }, { id: "suggestion", label: "Sugestões" }, { id: "transporte", label: "Transporte" }, { id: "cultura", label: "Cultura" }, { id: "comida", label: "Comida" }, { id: "noite", label: "Noite" }];
    const items = day.items.filter((item) => state.itineraryFilter === "all" || item.status === state.itineraryFilter || item.category === state.itineraryFilter);
    const dayAlerts = state.data.alerts.filter((alert) => alert.date === day.date);
    return `<section aria-labelledby="itinerary-title"><div class="section-heading"><div><p class="eyebrow">linha do tempo</p><h2 id="itinerary-title">Roteiro</h2><p>${escapeHTML(state.data.trip.summary)}</p></div>${actionButton("Ir para Hoje", "set-view", "home", "button button-secondary button-small")}</div>${renderDatePicker()}<div class="filter-row" aria-label="Filtros do roteiro">${filters.map((filter) => `<button type="button" class="filter-chip ${state.itineraryFilter === filter.id ? "is-selected" : ""}" data-action="filter-itinerary" data-value="${filter.id}" aria-pressed="${state.itineraryFilter === filter.id}">${filter.label}</button>`).join("")}</div>${dayAlerts.map(renderAlert).join("")}<section class="card"><div class="day-heading"><div><h3>${escapeHTML(formatLongDate(day.date))}</h3><p>${escapeHTML(day.city)} · ${escapeHTML(day.base)}</p></div><span class="badge planned">${day.items.length} itens</span></div><div class="timeline">${items.length ? items.map((item) => itemCard(item, null)).join("") : `<div class="empty-state">Nenhum item corresponde a este filtro. Tente “Todos”.</div>`}</div></section></section>`;
  }

  const pointTypes = {
    hospedagem: { label: "Hotel", color: "#0b5d5e" },
    transporte: { label: "Transporte", color: "#5b6670" },
    cultura: { label: "Cultura", color: "#245a83" },
    teatro: { label: "Teatro", color: "#7a3b96" },
    comida: { label: "Comida", color: "#b4541a" },
    passeio: { label: "Passeio", color: "#2f7d32" },
    noite: { label: "Noite", color: "#3b3b98" },
    compras: { label: "Livraria", color: "#a0306b" },
  };
  let tripMap = null;
  let tripMarkers = {};

  function pointColor(point) { return (pointTypes[point.type] || pointTypes.cultura).color; }
  function pointTypeLabel(point) { return (pointTypes[point.type] || { label: point.type }).label; }
  function pointMapsUrl(point) { return `https://maps.apple.com/?ll=${point.lat},${point.lng}&q=${encodeURIComponent(point.label)}`; }
  function pointDirectionsUrl(point) { return `https://maps.apple.com/?daddr=${point.lat},${point.lng}&dirflg=r`; }
  function pointDates(point) { return (point.dates || []).map((date) => formatDate(date)).join(" · "); }

  function visibleMapPoints() {
    return state.data.mapPoints.filter((point) => (state.mapCity === "all" || point.city === state.mapCity)
      && (state.mapDay === "all" || (point.dates || []).includes(state.mapDay)));
  }

  function defaultMapCity(date) {
    const day = state.data.days.find((candidate) => candidate.date === date);
    if (!day) return "Londres";
    if (day.city.startsWith("Edimburgo")) return "Edimburgo";
    if (day.city.startsWith("Oxford")) return "Oxford";
    return "Londres";
  }

  function renderMap() {
    const cities = ["Londres", "Edimburgo", "Oxford"];
    const points = visibleMapPoints();
    const usedTypes = [...new Set(points.map((point) => point.type))];
    const chip = (value, label) => `<button type="button" class="filter-chip ${state.mapCity === value ? "is-selected" : ""}" data-action="map-city" data-value="${escapeHTML(value)}" aria-pressed="${state.mapCity === value}">${escapeHTML(label)}</button>`;
    return `<section aria-labelledby="map-title"><div class="section-heading"><div><p class="eyebrow">mapa interativo</p><h2 id="map-title">Mapa</h2><p>Toque num ponto para ver o nome e abrir a rota no Apple Maps.</p></div></div>
      <div class="filter-row" aria-label="Cidade">${chip("all", "Todas")}${cities.map((city) => chip(city, city)).join("")}</div>
      <div class="map-filters"><label class="sr-only" for="day-filter">Filtrar por dia</label><select id="day-filter" class="select" data-action="map-day"><option value="all">Todos os dias</option>${state.data.days.map((day) => `<option value="${day.date}" ${state.mapDay === day.date ? "selected" : ""}>${escapeHTML(formatDate(day.date))} · ${escapeHTML(day.weekday)} · ${escapeHTML(day.city)}</option>`).join("")}</select><button class="button button-secondary button-small" type="button" data-action="locate">Onde estou</button></div>
      <div class="map-frame"><div id="trip-map" class="trip-map" role="region" aria-label="Mapa com ${points.length} local(is)"><div class="map-fallback">Carregando mapa…</div></div></div>
      <div class="map-legend" aria-label="Legenda">${usedTypes.map((type) => `<span><i style="background:${(pointTypes[type] || pointTypes.cultura).color}"></i>${escapeHTML((pointTypes[type] || { label: type }).label)}</span>`).join("")}</div>
      <h3 class="map-list-title">${points.length} local(is) ${state.mapDay !== "all" ? `em ${escapeHTML(formatDate(state.mapDay))}` : ""}</h3>
      <div class="map-list" aria-label="Lista de locais">${points.length ? points.map((point) => `<article class="card card-pad map-card"><div class="item-meta"><span class="type-dot" style="background:${pointColor(point)}" aria-hidden="true"></span><span class="eyebrow">${escapeHTML(pointTypeLabel(point))}</span><span class="badge planned">${escapeHTML(point.city)}</span></div><h3>${escapeHTML(point.label)}</h3><p class="item-place">${escapeHTML(point.address)}</p><p class="small muted">${escapeHTML(pointDates(point))}</p><div class="button-row"><button class="button button-small" type="button" data-action="focus-point" data-value="${escapeHTML(point.id)}">Ver no mapa</button><a class="button button-secondary button-small" href="${pointDirectionsUrl(point)}" target="_blank" rel="noopener noreferrer">Como chegar ↗</a><button class="button button-quiet button-small" type="button" data-action="copy" data-value="${escapeHTML(point.address)}">Copiar endereço</button></div></article>`).join("") : `<div class="empty-state">Nenhum local para este filtro. Tente “Todas” ou “Todos os dias”.</div>`}</div></section>`;
  }

  function destroyMap() {
    if (tripMap) { tripMap.remove(); tripMap = null; }
    tripMarkers = {};
  }

  function initMap() {
    const element = document.querySelector("#trip-map");
    if (!element) return;
    const points = visibleMapPoints();
    if (typeof window.L === "undefined") {
      element.innerHTML = `<div class="map-fallback">O mapa não pôde ser carregado agora (sem conexão?). Use a lista abaixo — “Como chegar” abre o Apple Maps.</div>`;
      return;
    }
    element.innerHTML = "";
    const L = window.L;
    tripMap = L.map(element, { scrollWheelZoom: false, zoomControl: true, attributionControl: true, zoomSnap: 0.5 });
    let tileErrors = 0;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors === 3) updateConnectionStatus("Mapa sem imagens de fundo (conexão fraca). Os pontos e a lista continuam disponíveis.");
    }).addTo(tripMap);
    points.forEach((point) => {
      const marker = L.circleMarker([point.lat, point.lng], { radius: 10, color: "#ffffff", weight: 3, fillColor: pointColor(point), fillOpacity: 1 })
        .addTo(tripMap)
        .bindPopup(`<div class="map-popup"><span class="eyebrow">${escapeHTML(pointTypeLabel(point))} · ${escapeHTML(point.city)}</span><strong>${escapeHTML(point.label)}</strong><span>${escapeHTML(point.address)}</span><span class="muted">${escapeHTML(pointDates(point))}</span><a href="${pointDirectionsUrl(point)}" target="_blank" rel="noopener noreferrer">Como chegar ↗</a><a href="${pointMapsUrl(point)}" target="_blank" rel="noopener noreferrer">Abrir no Apple Maps ↗</a></div>`, { maxWidth: 260 });
      marker.bindTooltip(point.label, { direction: "top", offset: [0, -8] });
      tripMarkers[point.id] = marker;
    });
    if (points.length === 1) tripMap.setView([points[0].lat, points[0].lng], 15);
    else if (points.length) {
      // Heathrow e Kew ficam longe do centro: só entram no enquadramento quando o dia filtrado pede.
      const core = state.mapDay === "all" && state.mapCity !== "all" ? points.filter((point) => !point.outer) : points;
      const framed = core.length ? core : points;
      tripMap.fitBounds(L.latLngBounds(framed.map((point) => [point.lat, point.lng])), { padding: [32, 32], maxZoom: 15 });
    }
    else tripMap.setView([51.5072, -0.1276], 12);
    setTimeout(() => tripMap && tripMap.invalidateSize(), 150);
  }

  function focusPoint(pointId) {
    const marker = tripMarkers[pointId];
    if (!tripMap || !marker) return;
    document.querySelector("#trip-map")?.scrollIntoView({ behavior: "smooth", block: "center" });
    tripMap.setView(marker.getLatLng(), 16);
    marker.openPopup();
  }

  function locateUser() {
    if (!tripMap) return;
    updateConnectionStatus("Procurando sua localização… (o iPhone pode pedir permissão)");
    tripMap.once("locationfound", (event) => {
      window.L.circleMarker(event.latlng, { radius: 8, color: "#ffffff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(tripMap).bindPopup("Você está aqui").openPopup();
      tripMap.setView(event.latlng, 15);
      updateConnectionStatus("Localização encontrada. Ela não é enviada a nenhum servidor.");
    });
    tripMap.once("locationerror", () => updateConnectionStatus("Não foi possível obter a localização. Verifique a permissão de Localização do Safari."));
    tripMap.locate({ setView: false, enableHighAccuracy: true, timeout: 10000 });
  }

  function renderTasks() {
    const groups = [...new Set(state.data.tasks.map((task) => task.group))];
    const remaining = state.data.tasks.filter((task) => !state.completed[task.id]).length;
    return `<section aria-labelledby="tasks-title"><div class="section-heading"><div><p class="eyebrow">operate</p><h2 id="tasks-title">Tarefas</h2><p>${remaining} pendência(s) aberta(s). Marcar como feito é local a este dispositivo e pode ser desfeito.</p></div></div><div class="task-groups">${groups.map((group) => `<section class="task-group"><h3>${escapeHTML(group)}</h3><div class="task-list">${state.data.tasks.filter((task) => task.group === group).map((task) => `<article class="task-row ${state.completed[task.id] ? "is-done" : ""}"><input id="task-${escapeHTML(task.id)}" type="checkbox" data-action="toggle-task" data-value="${escapeHTML(task.id)}" ${state.completed[task.id] ? "checked" : ""}><label for="task-${escapeHTML(task.id)}"><strong>${escapeHTML(task.title)}</strong><p><b>Por que importa:</b> ${escapeHTML(task.why)}</p><p><b>Próxima ação:</b> ${escapeHTML(task.next)}</p></label></article>`).join("")}</div></section>`).join("")}</div></section>`;
  }

  function renderMore() {
    return `<section aria-labelledby="more-title"><div class="section-heading"><div><p class="eyebrow">referências públicas</p><h2 id="more-title">Mais</h2><p>O que é útil sem misturar a camada pública com reservas e documentos.</p></div></div><div class="grid"><section class="span-8"><h3>Hospedagens vigentes</h3><div class="lodging-list">${state.data.lodgings.map((lodging) => `<article class="lodging-card"><div class="item-meta"><span class="badge confirmed">${escapeHTML(lodging.statusLabel)}</span><span class="muted">${escapeHTML(lodging.dates)}</span></div><h3>${escapeHTML(lodging.name)}</h3><p class="item-place">${escapeHTML(lodging.city)} · ${escapeHTML(lodging.address)}</p><a class="button button-secondary button-small" href="${routeUrl(lodging.address)}" target="_blank" rel="noopener noreferrer">Abrir rota ↗</a></article>`).join("")}</div></section><section class="span-4"><div class="disclosure emergency"><h3>${escapeHTML(state.data.emergency.title)}</h3><div class="emergency-numbers">${state.data.emergency.numbers.map((number) => `<strong>${escapeHTML(number)}</strong>`).join("")}</div><p class="small">${escapeHTML(state.data.emergency.note)}</p></div></section><section class="span-6"><div class="card card-pad"><h3>Links oficiais</h3><div class="link-list">${state.data.links.map((link) => `<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)} ↗</a>`).join("")}</div></div></section><section class="span-6"><div class="preview-banner"><strong>Sobre esta página</strong><p>Roteiro público para quem acompanha a viagem. Reservas, documentos e dados pessoais ficam fora daqui. Dica: no iPhone, use Compartilhar → “Adicionar à Tela de Início”.</p></div></section><section class="span-12"><details class="disclosure"><summary>Privacidade e limites desta versão</summary><p>Não incluímos nomes completos, localizadores, QR codes, e-tickets, documentos, dados de pagamento, contatos privados, assentos, códigos de reserva ou arquivos-fonte. Reservas e documentos devem ficar em área protegida, se forem implementados futuramente.</p><p class="small muted">Conteúdo revisado em ${escapeHTML(formatDate(state.data.trip.lastReviewed, {day:"numeric", month:"long", year:"numeric"}))} · fuso do roteiro: ${escapeHTML(state.data.trip.timezone)}</p></details></section></div></section>`;
  }

  function renderAlertView() {
    return `<div class="section-heading"><div><h2>Alertas</h2></div></div>${state.data.alerts.map(renderAlert).join("")}`;
  }

  function render() {
    if (!state.data) return;
    if (!publicViews.has(state.view)) state.view = "home";
    destroyMap();
    const views = { home: renderHome, itinerary: renderItinerary, map: renderMap, tasks: renderTasks, more: renderMore };
    appContent.innerHTML = views[state.view]();
    appContent.hidden = false;
    loading.hidden = true;
    if (state.view === "map") initMap();
    document.querySelectorAll(".nav-item").forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    document.title = `${state.view === "home" ? "Hoje" : { itinerary: "Roteiro", map: "Mapa", tasks: "Tarefas", more: "Mais" }[state.view]} · ${state.data.trip.publicTitle}`;
  }

  function setView(view) {
    state.view = publicViews.has(view) ? view : "home";
    window.history.replaceState({}, "", `#${state.view}`);
    render();
    document.querySelector("#main-content")?.focus({ preventScroll: true });
  }

  function openDetails(itemId) {
    const item = allItems().find((candidate) => candidate.id === itemId);
    if (!item) return;
    const itemLinks = item.links?.filter((link) => link.url) || [];
    detailContent.innerHTML = `<div class="detail-inner"><p class="eyebrow">${escapeHTML(categoryLabel(item.category))} · ${escapeHTML(item.statusLabel || statusLabels[item.status] || "Estado não informado")}</p><h2 id="detail-title">${escapeHTML(item.title)}</h2><p><strong>${escapeHTML(item.date ? formatLongDate(item.date) : "")}</strong> · ${escapeHTML(item.start === "flex" ? "horário flexível" : item.start)}</p>${statusBadge(item)}<div class="detail-address"><strong>${escapeHTML(item.place)}</strong><br>${escapeHTML(item.address || "Endereço a confirmar")}</div><div class="detail-section"><h3>O plano</h3><p>${escapeHTML(item.summary)}</p>${item.note ? `<p class="alert attention"><strong>Atenção:</strong> ${escapeHTML(item.note)}</p>` : ""}</div><div class="detail-section"><h3>Link oficial</h3>${itemLinks.length ? itemLinks.map((link) => `<p><a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)} ↗</a></p>`).join("") : `<p class="muted">Link oficial não incluído nesta prévia; confira a fonte antes de sair.</p>`}</div><div class="detail-section"><h3>Privacidade</h3><p class="muted">Códigos de reserva, ingressos e documentos ficam fora desta prévia pública.</p></div><div class="button-row">${routeButton(item)}${actionButton(state.completed[item.id] ? "Desmarcar como feito" : "Marcar como feito", "toggle-item", item.id, "button button-quiet button-small")}</div></div>`;
    if (typeof detailDialog.showModal === "function") detailDialog.showModal(); else detailDialog.setAttribute("open", "open");
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      updateConnectionStatus("Endereço copiado para a área de transferência.");
    } catch (_) {
      updateConnectionStatus("Não foi possível copiar automaticamente; selecione o endereço na lista.");
    }
  }

  function toggleItem(itemId) {
    state.completed[itemId] = !state.completed[itemId];
    saveCompletedTasks();
    render();
    if (detailDialog.open) detailDialog.close();
  }

  function handleAction(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const value = target.dataset.value;
    if (action === "set-view") setView(value);
    if (action === "select-date") { state.selectedDate = value; state.view = "itinerary"; window.history.replaceState({}, "", "#itinerary"); render(); }
    if (action === "filter-itinerary") { state.itineraryFilter = value; render(); }
    if (action === "map-city" && event.type === "click") { state.mapCity = value || "all"; render(); }
    if (action === "map-day" && event.type === "change") { state.mapDay = target.value || "all"; if (state.mapDay !== "all") state.mapCity = "all"; render(); }
    if (action === "focus-point") focusPoint(value);
    if (action === "locate") locateUser();
    if (action === "detail") openDetails(value);
    if (action === "toggle-item") toggleItem(value);
    if (action === "copy") copyText(value);
    if (action === "toggle-theme") toggleTheme();
    if (action === "retry") loadData();
    if (action === "toggle-task") { state.completed[value] = target.checked; saveCompletedTasks(); render(); }
  }

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("trip-public-theme", root.dataset.theme); } catch (_) { /* ignore */ }
  }

  function updateConnectionStatus(message) {
    if (message) statusElement.textContent = message;
    const offline = !navigator.onLine;
    statusElement.classList.toggle("is-offline", offline);
    if (offline && !message) statusElement.textContent = `Offline · última versão pública de ${formatDate(state.data?.trip.lastReviewed || "2026-11-01", { day: "numeric", month: "short" })}`;
    if (!offline && !message && state.data) statusElement.textContent = `Online · conteúdo revisado em ${formatDate(state.data.trip.lastReviewed, { day: "numeric", month: "short", year: "numeric" })}`;
  }

  async function loadData() {
    try {
      const response = await fetch("data/trip-public.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      state.selectedDate = dateForToday();
      state.mapCity = defaultMapCity(state.selectedDate);
      try {
        const savedTheme = localStorage.getItem("trip-public-theme");
        if (savedTheme) document.documentElement.dataset.theme = savedTheme;
      } catch (_) { /* ignore */ }
      render();
      updateConnectionStatus();
    } catch (error) {
      loading.innerHTML = `<div class="error-state"><h2>Não foi possível carregar o roteiro</h2><p>Verifique a conexão ou abra a versão servida por um servidor local. A última versão pode estar disponível após a primeira visita.</p><button class="button" type="button" data-action="retry">Tentar novamente</button><p class="small muted">${escapeHTML(error.message)}</p></div>`;
      loading.hidden = false;
      appContent.hidden = true;
    }
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-view]");
    if (target) { setView(target.dataset.view); return; }
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget && actionTarget.dataset.action !== "toggle-task") handleAction(event);
  });
  document.addEventListener("change", handleAction);
  window.addEventListener("online", () => updateConnectionStatus("Online · conexão restaurada."));
  window.addEventListener("offline", () => updateConnectionStatus());
  window.addEventListener("hashchange", () => { state.view = window.location.hash.slice(1) || "home"; render(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => updateConnectionStatus("Online · modo sem cache offline disponível."));
  loadData();
})();
