<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { supabase } from "$lib/supabaseClient";
    import {
        RefreshCcw,
        Wallet,
        Landmark,
        TrendingUp,
        TrendingDown,
        Clock,
        CheckCircle2,
        Banknote,
        History,
        Plus,
        ScanText,
    } from "lucide-svelte";
    import { page } from "$app/stores";

    let loading = true;
    let loadingRate = false;

    // Exchange Rate State
    let currentRate: number | null = null;
    let rateDate: string | null = null;

    // Session State
    let activeSession: any = null;
    let movements: any[] = [];
    let userId: string = "";

    // Modals State
    let showMovementModal = false;
    let movementType: "in" | "out" = "in";
    let newAmount: string = "";
    let newCurrency: "USD" | "VES" = "VES";
    let newDescription: string = "";
    let isSubmitting = false;
    let isScanning = false;
    let fileInput: HTMLInputElement;

    // View State
    let showConvertedUsd = false;

    onMount(async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session) {
            userId = session.user.id;
        }

        await fetchExchangeRate();
        await fetchActiveSession();

        // Subscribe to real-time changes on cash_movements and cash_sessions
        setupRealtimeSubscription();
    });

    let subscription: any;

    function setupRealtimeSubscription() {
        subscription = supabase
            .channel("cash_updates")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "cash_sessions" },
                (payload) => {
                    if (activeSession && payload.new.id === activeSession.id) {
                        activeSession = payload.new;
                    } else if (payload.new.status === "open") {
                        // A new session was opened somewhere else
                        activeSession = payload.new;
                        fetchMovements(activeSession.id);
                    } else if (
                        payload.new.status === "closed" &&
                        activeSession &&
                        payload.new.id === activeSession.id
                    ) {
                        activeSession = null;
                        movements = [];
                    }
                },
            )
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "cash_movements" },
                (payload) => {
                    if (
                        activeSession &&
                        payload.new.session_id === activeSession.id
                    ) {
                        // Prepend the new movement
                        movements = [payload.new, ...movements];
                    }
                },
            )
            .subscribe();
    }

    onDestroy(() => {
        if (subscription) supabase.removeChannel(subscription);
    });

    async function fetchExchangeRate() {
        loadingRate = true;

        // 1. Try to fetch from DB first (today's rate)
        const options: Intl.DateTimeFormatOptions = {
            timeZone: "America/Caracas",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        };
        const formatter = new Intl.DateTimeFormat("en-CA", options);
        const todayStr = formatter.format(new Date());

        const { data, error } = await supabase
            .from("exchange_rates")
            .select("ves_to_usd, date")
            .eq("date", todayStr)
            .maybeSingle();

        if (data) {
            currentRate = data.ves_to_usd;
            rateDate = data.date;
        } else {
            // 2. Not in DB? Trigger the API Scraper (Lazy Load)
            try {
                const res = await fetch("/api/cron/bcv-rate");
                const rateData = await res.json();
                if (rateData && rateData.rate) {
                    currentRate = rateData.rate;
                    rateDate = rateData.date;
                }
            } catch (err) {
                console.error("Error fetching rate via API", err);
            }
        }
        loadingRate = false;
    }

    async function fetchActiveSession() {
        loading = true;
        const { data, error } = await supabase
            .from("cash_sessions")
            .select("*")
            .eq("status", "open")
            .order("opened_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data) {
            activeSession = data;
            await fetchMovements(activeSession.id);
        } else {
            activeSession = null;
        }
        loading = false;
    }

    async function fetchMovements(sessionId: string) {
        const { data, error } = await supabase
            .from("cash_movements")
            .select("*, profiles(email)")
            .eq("session_id", sessionId)
            .eq("user_id", userId) // Caja Ciega: Only fetch my own movements
            .order("created_at", { ascending: false });

        if (data) movements = data;
    }

    async function refreshDataSilent() {
        if (!activeSession) return;
        const { data: sessionData } = await supabase
            .from("cash_sessions")
            .select("*")
            .eq("id", activeSession.id)
            .single();
        if (sessionData) {
            activeSession = sessionData;
        }
        await fetchMovements(activeSession.id);
    }

    async function openSession() {
        const { data, error } = await supabase
            .from("cash_sessions")
            .insert([{ opened_by: userId, status: "open" }])
            .select()
            .single();

        if (error) {
            alert("Error abriendo jornada: " + error.message);
        } else {
            activeSession = data;
            movements = [];
        }
    }

    async function closeSession() {
        if (
            !confirm(
                "¿Estás seguro de cerrar la jornada actual? No podrás agregar más movimientos.",
            )
        )
            return;

        const { error } = await supabase
            .from("cash_sessions")
            .update({
                status: "closed",
                closed_by: userId,
                closed_at: new Date().toISOString(),
            })
            .eq("id", activeSession.id);

        if (error) {
            alert("Error cerrando jornada: " + error.message);
        } else {
            activeSession = null;
            movements = [];
        }
    }

    function openMovementForm(type: "in" | "out") {
        movementType = type;
        newAmount = "";
        newDescription = "";
        newCurrency = "VES";
        showMovementModal = true;
    }

    function closeMovementForm() {
        showMovementModal = false;
        isSubmitting = false;
    }

    async function submitMovement() {
        const amountNum = parseFloat(newAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert("Ingresa un monto válido mayor a 0");
            return;
        }

        isSubmitting = true;

        const { error } = await supabase.from("cash_movements").insert([
            {
                session_id: activeSession.id,
                user_id: userId,
                type: movementType,
                amount: amountNum,
                currency: newCurrency,
                description: newDescription.trim(),
            },
        ]);

        isSubmitting = false;

        if (error) {
            alert("Error registrando movimiento: " + error.message);
        } else {
            closeMovementForm();
            // Fallback: Manually re-fetch session and movements to ensure UI updates
            // even if Supabase Realtime fails to broadcast the event.
            await fetchActiveSession();
        }
    }

    async function handleScanUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        isScanning = true;
        const file = input.files[0];

        try {
            // Read file as Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64String = reader.result as string;

                const response = await fetch("/api/admin/ocr", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageBase64: base64String }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (
                        data.extracted.amount &&
                        data.extracted.amount !== "0"
                    ) {
                        newAmount = data.extracted.amount;
                    }
                    if (data.extracted.reference) {
                        newDescription = "Ref: " + data.extracted.reference;
                    }
                    // Default to VES assuming Pago Movil captures
                    newCurrency = "VES";
                } else {
                    alert(
                        "Error en el escaneo: " + (data.error || "Desconocido"),
                    );
                }
                isScanning = false;
                if (fileInput) fileInput.value = ""; // reset
            };

            reader.onerror = () => {
                alert("Error leyendo el archivo");
                isScanning = false;
            };
        } catch (err: any) {
            console.error(err);
            alert("Error procesando imagen: " + err.message);
            isScanning = false;
        }
    }

    // Helpers
    const formatMoney = (val: number, curr: string) => {
        const displayCurr = curr === "VES" ? "BS" : curr;
        return new Intl.NumberFormat("es-VE", {
            style: "currency",
            currency: curr === "VES" ? "VED" : curr, // VED is the closest ISO for Bs internally in some formats, but we can just use symbol replacement
        })
            .format(val || 0)
            .replace("VED", "BS")
            .replace("VES", "BS");
    };

    // Derived Local Balances (Caja Ciega) based on the user's isolated array
    $: totalInVes = movements
        .filter((m) => m.type === "in" && m.currency === "VES")
        .reduce((sum, m) => sum + Number(m.amount), 0);
    $: totalOutVes = movements
        .filter((m) => m.type === "out" && m.currency === "VES")
        .reduce((sum, m) => sum + Number(m.amount), 0);
    $: totalInUsd = movements
        .filter((m) => m.type === "in" && m.currency === "USD")
        .reduce((sum, m) => sum + Number(m.amount), 0);
    $: totalOutUsd = movements
        .filter((m) => m.type === "out" && m.currency === "USD")
        .reduce((sum, m) => sum + Number(m.amount), 0);

    // Unificado a VES
    $: totalEquivalentVes = currentRate
        ? totalInVes - totalOutVes + (totalInUsd - totalOutUsd) * currentRate
        : totalInVes - totalOutVes;

    $: totalEquivalentUsd = currentRate
        ? totalInUsd - totalOutUsd + (totalInVes - totalOutVes) / currentRate
        : totalInUsd - totalOutUsd;

    $: totalInEquivalentVes = currentRate
        ? totalInVes + totalInUsd * currentRate
        : totalInVes;
    $: totalOutEquivalentVes = currentRate
        ? totalOutVes + totalOutUsd * currentRate
        : totalOutVes;
    $: totalInEquivalentUsd = currentRate
        ? totalInUsd + totalInVes / currentRate
        : totalInUsd;
    $: totalOutEquivalentUsd = currentRate
        ? totalOutUsd + totalOutVes / currentRate
        : totalOutUsd;

    // Derived equivalents for the modal
    $: currentInputAmount = parseFloat(newAmount) || 0;
    $: equivalentInUsd =
        currentRate && newCurrency === "VES"
            ? currentInputAmount / currentRate
            : 0;
    $: equivalentInVes =
        currentRate && newCurrency === "USD"
            ? currentInputAmount * currentRate
            : 0;
</script>

<div class="container dashboard">
    <!-- Header & Exchange Rate -->
    <div class="header-section">
        <h1
            class="page-title"
            style="display:flex; align-items:center; gap:8px; margin:0; font-size: 24px;"
        >
            <Landmark size={28} /> Control de Caja
        </h1>

        <div class="rate-badge glass-panel" title="Tasa BCV Referencial">
            <RefreshCcw size={14} class={loadingRate ? "spin" : ""} />
            {#if currentRate}
                <span>1 USD = {currentRate} VES</span>
            {:else}
                <span>Tasa No Disponible</span>
            {/if}
        </div>
    </div>

    {#if loading}
        <div class="loading-state">
            <RefreshCcw size={24} class="spin" />
            <p>Comprobando estado de caja...</p>
        </div>
    {:else if !activeSession}
        <!-- No Session Open State -->
        <div class="empty-state glass-panel">
            <Wallet
                size={48}
                color="var(--text-secondary)"
                style="margin-bottom: 16px;"
            />
            <h2 style="margin-bottom: 8px;">La Caja está Cerrada</h2>
            <p
                style="color: var(--text-secondary); margin-bottom: 24px; max-width: 300px;"
            >
                Debes abrir una jornada para empezar a registrar movimientos de
                entrada y salida de dinero.
            </p>
            <button
                class="btn btn-primary"
                on:click={openSession}
                style="font-size: 16px; padding: 12px 24px;"
            >
                <Clock size={18} style="margin-right:8px;" /> Abrir Jornada de Hoy
            </button>
        </div>
    {:else}
        <!-- Active Session Dashboard -->

        <!-- Summary Cards -->
        <div class="summary-grid">
            <!-- Unified Card -->
            <div
                class="stat-card glass-panel"
                style="border-left: 4px solid var(--accent-color);"
            >
                <div
                    style="display: flex; justify-content: space-between; align-items: flex-start;"
                >
                    <h3 class="stat-title">
                        <Banknote size={16} /> Saldo {showConvertedUsd
                            ? "(Aprox USD)"
                            : "General"}
                    </h3>
                    {#if currentRate}
                        <button
                            class="btn btn-secondary"
                            style="padding: 4px 10px; font-size: 11px; height: auto;"
                            on:click={() =>
                                (showConvertedUsd = !showConvertedUsd)}
                        >
                            <RefreshCcw size={12} style="margin-right: 4px;" />
                            {showConvertedUsd ? "Ver en BS" : "Convertir a USD"}
                        </button>
                    {/if}
                </div>

                <div class="stat-value text-accent">
                    {#if showConvertedUsd}
                        {formatMoney(totalEquivalentUsd, "USD")}
                    {:else}
                        {formatMoney(totalEquivalentVes, "VES")}
                    {/if}
                </div>

                <div class="stat-meta">
                    <span class="text-success"
                        ><TrendingUp size={12} />
                        {showConvertedUsd
                            ? formatMoney(totalInEquivalentUsd, "USD")
                            : formatMoney(totalInEquivalentVes, "VES")}</span
                    >
                    <span class="text-danger" style="margin-left:8px;"
                        ><TrendingDown size={12} />
                        {showConvertedUsd
                            ? formatMoney(totalOutEquivalentUsd, "USD")
                            : formatMoney(totalOutEquivalentVes, "VES")}</span
                    >
                </div>
            </div>
        </div>

        <!-- Actions -->
        <div class="actions-grid">
            <button
                class="btn btn-primary btn-in"
                on:click={() => openMovementForm("in")}
            >
                <TrendingUp size={18} style="margin-right: 6px;" /> Registrar Entrada
            </button>
            <button
                class="btn btn-primary btn-out"
                on:click={() => openMovementForm("out")}
            >
                <TrendingDown size={18} style="margin-right: 6px;" /> Registrar Salida
            </button>
            <a href="/admin/cash/history" class="btn btn-secondary">
                <History size={16} style="margin-right: 6px;" /> Historial
            </a>
            <button
                class="btn btn-secondary btn-close-session"
                on:click={closeSession}
            >
                <CheckCircle2 size={16} style="margin-right: 6px;" /> Cerrar Jornada
            </button>
        </div>

        <!-- Movements List -->
        <div class="movements-container glass-panel">
            <h3 class="section-title">
                <History size={18} /> Últimos Movimientos
                <span class="count-badge">{movements.length}</span>
            </h3>

            <div class="table-responsive">
                {#if movements.length === 0}
                    <p class="empty-list">
                        No hay movimientos registrados en esta jornada.
                    </p>
                {:else}
                    <table class="movements-table">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Tipo</th>
                                <th>Monto</th>
                                <th>Concepto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each movements as mov}
                                <tr>
                                    <td class="time-cell"
                                        >{new Date(
                                            mov.created_at,
                                        ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}</td
                                    >
                                    <td>
                                        <span
                                            class="type-badge {mov.type === 'in'
                                                ? 'badge-in'
                                                : 'badge-out'}"
                                        >
                                            {mov.type === "in"
                                                ? "ENTRADA"
                                                : "SALIDA"}
                                        </span>
                                    </td>
                                    <td
                                        class="amount-cell {mov.type === 'in'
                                            ? 'text-success'
                                            : 'text-danger'}"
                                    >
                                        {mov.type === "in"
                                            ? "+"
                                            : "-"}{formatMoney(
                                            mov.amount,
                                            mov.currency,
                                        )}
                                    </td>
                                    <td>
                                        <div class="desc-cell">
                                            {mov.description || "Sin concepto"}
                                        </div>
                                        <div class="user-cell">
                                            {mov.profiles?.email || "Sistema"}
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Movement Modal -->
    {#if showMovementModal}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="modal-backdrop" on:click={closeMovementForm}>
            <div class="modal-content glass-panel" on:click|stopPropagation>
                <h2
                    style="margin-bottom: 24px; display: flex; align-items: center; gap: 8px;"
                    class:text-success={movementType === "in"}
                    class:text-danger={movementType === "out"}
                >
                    {#if movementType === "in"}
                        <TrendingUp size={24} /> Nueva Entrada
                    {:else}
                        <TrendingDown size={24} /> Nueva Salida
                    {/if}
                </h2>

                <div style="margin-bottom: 20px;">
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style="display: none;"
                        bind:this={fileInput}
                        on:change={handleScanUpload}
                    />
                    <button
                        class="btn btn-secondary"
                        style="width: 100%; border: 1px dashed var(--accent-color); color: var(--accent-color); background: rgba(var(--accent-rgb), 0.05);"
                        on:click={() => fileInput.click()}
                        disabled={isScanning || isSubmitting}
                    >
                        {#if isScanning}
                            <RefreshCcw
                                size={18}
                                class="spin"
                                style="margin-right: 8px;"
                            /> Procesando captura con OCR...
                        {:else}
                            <ScanText size={18} style="margin-right: 8px;" /> Autocompletar
                            con Captura
                        {/if}
                    </button>
                </div>

                <div class="input-group">
                    <label class="input-label" for="movCurrency">Moneda</label>
                    <div class="currency-toggle">
                        <button
                            class="btn {newCurrency === 'USD'
                                ? 'btn-primary'
                                : 'btn-secondary'}"
                            on:click={() => (newCurrency = "USD")}
                            style="flex:1;">USD</button
                        >
                        <button
                            class="btn {newCurrency === 'VES'
                                ? 'btn-primary'
                                : 'btn-secondary'}"
                            on:click={() => (newCurrency = "VES")}
                            style="flex:1;">BS</button
                        >
                    </div>
                </div>

                <div class="input-group">
                    <label class="input-label" for="movAmount"
                        >Monto ({newCurrency === "VES" ? "BS" : "USD"})</label
                    >
                    <input
                        id="movAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        class="input-field amount-input"
                        placeholder="0.00"
                        bind:value={newAmount}
                    />

                    {#if currentRate && currentInputAmount > 0}
                        <div
                            style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);"
                        >
                            {#if newCurrency === "VES"}
                                Equivalente: <strong class="text-accent"
                                    >{formatMoney(
                                        equivalentInUsd,
                                        "USD",
                                    )}</strong
                                >
                            {:else}
                                Equivalente: <strong class="text-accent"
                                    >{formatMoney(
                                        equivalentInVes,
                                        "VES",
                                    )}</strong
                                >
                            {/if}
                        </div>
                    {/if}
                </div>

                <div class="input-group">
                    <label class="input-label" for="movDesc"
                        >Concepto / Descripción (Opcional)</label
                    >
                    <input
                        id="movDesc"
                        type="text"
                        class="input-field"
                        placeholder="Ej: Pago de cliente Maria, Retiro..."
                        bind:value={newDescription}
                    />
                </div>

                <div class="modal-actions">
                    <button
                        class="btn btn-secondary"
                        style="flex: 1;"
                        on:click={closeMovementForm}
                        disabled={isSubmitting}>Cancelar</button
                    >
                    <button
                        class="btn {movementType === 'in'
                            ? 'btn-in'
                            : 'btn-out'}"
                        style="flex: 1;"
                        on:click={submitMovement}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Guardando..." : "Confirmar"}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .dashboard {
        padding-top: 24px;
        padding-bottom: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
    }

    .rate-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        background: rgba(var(--accent-rgb), 0.1);
        border: 1px solid rgba(var(--accent-rgb), 0.2);
    }

    .spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        100% {
            transform: rotate(360deg);
        }
    }

    /* States */
    .empty-state,
    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 48px 24px;
        min-height: 400px;
    }

    .loading-state {
        gap: 16px;
        color: var(--text-secondary);
    }

    /* Summary Dashboard */
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
    }

    .stat-card {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .stat-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
    }

    .stat-value {
        font-size: 28px;
        font-weight: 700;
        line-height: 1.2;
    }

    .stat-meta {
        font-size: 12px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
    }

    .highlight-card {
        background: linear-gradient(
            135deg,
            rgba(var(--accent-rgb), 0.1) 0%,
            rgba(var(--bg-color), 0.5) 100%
        );
        border: 1px solid rgba(var(--accent-rgb), 0.3);
    }

    /* Actions Grid */
    .actions-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }

    .actions-grid .btn {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .btn-in {
        background-color: #34c759 !important;
        border-color: #34c759 !important;
        color: white !important;
    }
    .btn-in:hover {
        filter: brightness(1.1);
    }
    .btn-out {
        background-color: #ff3b30 !important;
        border-color: #ff3b30 !important;
        color: white !important;
    }
    .btn-out:hover {
        filter: brightness(1.1);
    }

    .btn-close-session {
        color: var(--text-color);
        border: 1px solid var(--surface-border);
    }

    .text-success {
        color: #34c759 !important;
    }
    .text-danger {
        color: #ff3b30 !important;
    }

    /* Movements List */
    .movements-container {
        padding: 20px;
        overflow: hidden;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        margin: 0 0 16px 0;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--surface-border);
    }

    .table-responsive {
        overflow-x: auto;
    }

    .movements-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }

    .movements-table th {
        text-align: left;
        padding: 12px 16px;
        color: var(--text-secondary);
        font-weight: 500;
        border-bottom: 1px solid var(--surface-border);
    }

    .movements-table td {
        padding: 16px;
        vertical-align: middle;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .time-cell {
        color: var(--text-secondary);
        font-size: 13px;
    }

    .desc-cell {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .user-cell {
        font-size: 12px;
        color: var(--text-secondary);
    }

    .amount-cell {
        font-weight: 600;
        font-size: 15px;
    }

    .type-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .badge-in {
        background: rgba(52, 199, 89, 0.15);
        color: #34c759;
    }
    .badge-out {
        background: rgba(255, 59, 48, 0.15);
        color: #ff3b30;
    }

    .empty-list {
        text-align: center;
        color: var(--text-secondary);
        padding: 32px 0;
    }

    /* Modal Tweaks */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 16px;
    }

    .modal-content {
        width: 100%;
        max-width: 420px;
        padding: 24px;
        background: var(--bg-color);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .currency-toggle {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
    }

    .amount-input {
        font-size: 24px;
        font-weight: 600;
        height: 48px;
    }

    .modal-actions {
        display: flex;
        gap: 12px;
        margin-top: 32px;
    }
</style>
