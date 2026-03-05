<script lang="ts">
    import { onMount } from "svelte";
    import { supabase } from "$lib/supabaseClient";
    import {
        RefreshCcw,
        History,
        ArrowLeft,
        Banknote,
        Search,
        Calendar,
    } from "lucide-svelte";

    let loading = false;
    let selectedDate = new Date().toISOString().split("T")[0]; // Defaults to today
    let movements: any[] = [];
    let currentRate: number | null = null;

    // Derived stats
    $: totalInBs = movements
        .filter((m) => m.type === "in" && m.currency === "VES")
        .reduce((sum, m) => sum + m.amount, 0);
    $: totalOutBs = movements
        .filter((m) => m.type === "out" && m.currency === "VES")
        .reduce((sum, m) => sum + m.amount, 0);
    $: totalInUsd = movements
        .filter((m) => m.type === "in" && m.currency === "USD")
        .reduce((sum, m) => sum + m.amount, 0);
    $: totalOutUsd = movements
        .filter((m) => m.type === "out" && m.currency === "USD")
        .reduce((sum, m) => sum + m.amount, 0);

    // Commission calculations (1% of incoming movements, excluding bank fees)
    $: eligibleInBs = movements
        .filter(
            (m) =>
                m.type === "in" &&
                m.currency === "VES" &&
                !/comisi(?:o|ó)n|com banca/i.test(m.description || ""),
        )
        .reduce((sum, m) => sum + m.amount, 0);
    $: eligibleInUsd = movements
        .filter(
            (m) =>
                m.type === "in" &&
                m.currency === "USD" &&
                !/comisi(?:o|ó)n|com banca/i.test(m.description || ""),
        )
        .reduce((sum, m) => sum + m.amount, 0);

    $: commissionBs = currentRate
        ? (eligibleInBs + eligibleInUsd * currentRate) * 0.01
        : eligibleInBs * 0.01;
    $: commissionUsd = currentRate
        ? (eligibleInUsd + eligibleInBs / currentRate) * 0.01
        : eligibleInUsd * 0.01;

    onMount(() => {
        fetchMovementsForDate();
    });

    async function fetchMovementsForDate() {
        if (!selectedDate) return;
        loading = true;

        // Create range for the selected day in local timezone roughly
        const startOfDay = new Date(selectedDate + "T00:00:00").toISOString();
        const endOfDay = new Date(selectedDate + "T23:59:59.999").toISOString();

        // Obtener la tasa de cambio del día seleccionado
        const { data: rateData } = await supabase
            .from("exchange_rates")
            .select("ves_to_usd")
            .eq("date", selectedDate)
            .maybeSingle();
        currentRate = rateData?.ves_to_usd || null;

        const { data, error } = await supabase
            .from("cash_movements")
            .select("*, profiles(email)")
            .gte("created_at", startOfDay)
            .lte("created_at", endOfDay)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            alert("Error consultando movimientos: " + error.message);
        } else {
            movements = data || [];
        }
        loading = false;
    }

    const formatMoney = (val: number, curr: string) => {
        const displayCurr = curr === "VES" ? "BS" : curr;
        return new Intl.NumberFormat("es-VE", {
            style: "currency",
            currency: curr === "VES" ? "VED" : curr,
        })
            .format(val || 0)
            .replace("VED", "BS")
            .replace("VES", "BS");
    };
</script>

<div class="container dashboard">
    <!-- Header -->
    <div class="header-section">
        <h1
            class="page-title"
            style="display:flex; align-items:center; gap:8px; margin:0; font-size: 24px;"
        >
            <History size={28} /> Historial de Caja
        </h1>

        <a
            href="/admin/cash"
            class="btn btn-secondary"
            style="text-decoration: none;"
        >
            <ArrowLeft size={16} style="margin-right: 6px;" /> Volver a Caja
        </a>
    </div>

    <!-- Filter Section -->
    <div class="filter-card glass-panel">
        <div class="input-group" style="margin-bottom: 0; max-width: 300px;">
            <label
                class="input-label"
                for="dateFilter"
                style="display:flex; align-items:center; gap:6px;"
            >
                <Calendar size={14} /> Seleccionar Fecha
            </label>
            <div style="display:flex; gap: 8px;">
                <input
                    id="dateFilter"
                    type="date"
                    class="input-field"
                    bind:value={selectedDate}
                />
                <button
                    class="btn btn-primary"
                    on:click={fetchMovementsForDate}
                    disabled={loading}
                >
                    {#if loading}
                        <RefreshCcw size={16} class="spin" />
                    {:else}
                        <Search size={16} /> Buscar
                    {/if}
                </button>
            </div>
        </div>
    </div>

    <!-- Day Summary -->
    {#if !loading && movements.length > 0}
        <div class="summary-grid">
            <div
                class="stat-card glass-panel"
                style="border-left: 4px solid #34c759;"
            >
                <h3 class="stat-title">Total Entradas del Día</h3>
                <div class="stat-value text-success" style="font-size: 20px;">
                    {formatMoney(totalInBs, "VES")}
                    <span
                        style="font-size: 14px; color: var(--text-secondary); margin-left:8px;"
                        >({formatMoney(totalInUsd, "USD")})</span
                    >
                </div>
            </div>
            <div
                class="stat-card glass-panel"
                style="border-left: 4px solid #ff3b30;"
            >
                <h3 class="stat-title">Total Salidas del Día</h3>
                <div class="stat-value text-danger" style="font-size: 20px;">
                    {formatMoney(totalOutBs, "VES")}
                    <span
                        style="font-size: 14px; color: var(--text-secondary); margin-left:8px;"
                        >({formatMoney(totalOutUsd, "USD")})</span
                    >
                </div>
            </div>
            <div
                class="stat-card glass-panel"
                style="border-left: 4px solid #f59e0b;"
            >
                <h3 class="stat-title">Mi Comisión (1%)</h3>
                <div
                    class="stat-value"
                    style="font-size: 20px; color: #f59e0b;"
                >
                    {formatMoney(commissionBs, "VES")}
                    <span
                        style="font-size: 14px; color: var(--text-secondary); margin-left:8px;"
                        >({formatMoney(commissionUsd, "USD")})</span
                    >
                </div>
            </div>
        </div>
    {/if}

    <!-- list -->
    <div class="movements-container glass-panel">
        <h3 class="section-title">
            Movimientos del {new Date(
                selectedDate + "T12:00:00",
            ).toLocaleDateString("es-VE")}
            {#if !loading && movements.length > 0}
                <span class="count-badge">{movements.length}</span>
            {/if}
        </h3>

        <div class="table-responsive">
            {#if loading}
                <div
                    style="padding: 40px; text-align: center; color: var(--text-secondary);"
                >
                    <RefreshCcw
                        size={24}
                        class="spin"
                        style="margin-bottom: 8px;"
                    />
                    <p>Consultando registros...</p>
                </div>
            {:else if movements.length === 0}
                <p class="empty-list">
                    No se encontraron movimientos para esta fecha.
                </p>
            {:else}
                <table class="movements-table">
                    <thead>
                        <tr>
                            <th>Hora</th>
                            <th>Tipo</th>
                            <th>Monto</th>
                            <th>Concepto / Usuario</th>
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
                                    {mov.type === "in" ? "+" : "-"}{formatMoney(
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

    .filter-card {
        padding: 20px;
    }

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

    .spin {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        100% {
            transform: rotate(360deg);
        }
    }

    /* Table styles duplicated to match dashboard */
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
        border-bottom: 2px solid var(--surface-border);
        white-space: nowrap;
    }
    .movements-table td {
        padding: 16px;
        border-bottom: 1px solid var(--surface-border);
        vertical-align: middle;
    }
    .movements-table tr:hover {
        background: rgba(255, 255, 255, 0.02);
    }
    .time-cell {
        color: var(--text-secondary);
        white-space: nowrap;
    }
    .type-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }
    .badge-in {
        background: rgba(52, 199, 89, 0.1);
        color: #34c759;
    }
    .badge-out {
        background: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
    }
    .amount-cell {
        font-weight: 600;
        white-space: nowrap;
    }
    .text-success {
        color: #34c759 !important;
    }
    .text-danger {
        color: #ff3b30 !important;
    }
    .desc-cell {
        font-weight: 500;
        margin-bottom: 4px;
    }
    .user-cell {
        font-size: 12px;
        color: var(--text-secondary);
    }
    .empty-list {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-secondary);
    }
    .count-badge {
        background-color: rgba(var(--accent-rgb), 0.15);
        color: var(--accent-color);
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
        margin-left: 8px;
        font-weight: 600;
        vertical-align: middle;
    }
</style>
