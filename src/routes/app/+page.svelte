<script lang="ts">
    import { onMount } from "svelte";
    import { supabase } from "$lib/supabaseClient";
    import { Plus, Minus, Lock } from "lucide-svelte";

    let currentSession: any = null;
    let movements: any[] = [];
    let loading = true;
    let userId: string = "";

    // Modal State
    let showMovementModal = false;
    let movementType: "in" | "out" = "in";
    let movementAmount = "";
    let movementDescription = "";
    let isSubmitting = false;

    // We do initialization
    onMount(async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session) {
            userId = session.user.id;
            await loadActiveSession();
        }
    });

    async function loadActiveSession() {
        loading = true;
        // 1. Fetch the latest open session
        const { data: sessionData, error: sessionError } = await supabase
            .from("cash_sessions")
            .select("*")
            .eq("status", "open")
            .order("opened_at", { ascending: false })
            .limit(1)
            .single();

        if (sessionError && sessionError.code !== "PGRST116") {
            // PGRST116 = No rows returned
            console.error("Error fetching session:", sessionError);
        }

        if (sessionData) {
            currentSession = sessionData;
            await loadMovements(sessionData.id);
        } else {
            currentSession = null;
            movements = [];
        }
        loading = false;
    }

    async function loadMovements(sessionId: string) {
        const { data: movs, error } = await supabase
            .from("cash_movements")
            .select("*, profiles(email)")
            .eq("session_id", sessionId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching movements:", error);
        } else {
            movements = movs || [];
        }
    }

    async function openSession() {
        loading = true;
        const { data, error } = await supabase
            .from("cash_sessions")
            .insert({
                opened_by: userId,
                status: "open",
                starting_balance: 0,
                total_in: 0,
                total_out: 0,
                ending_balance: 0,
            })
            .select()
            .single();

        if (error) {
            alert("Error abriendo jornada: " + error.message);
        } else {
            currentSession = data;
        }
        loading = false;
    }

    async function closeSession() {
        if (
            !confirm(
                "¿Estás seguro de cerrar la jornada actual? No podrás agregar más movimientos hoy.",
            )
        )
            return;

        loading = true;
        const { error } = await supabase
            .from("cash_sessions")
            .update({
                status: "closed",
                closed_by: userId,
                closed_at: new Date().toISOString(),
            })
            .eq("id", currentSession.id);

        if (error) {
            alert("Error cerrando jornada: " + error.message);
            loading = false;
        } else {
            await loadActiveSession(); // This will render "no session open"
        }
    }

    function openModal(type: "in" | "out") {
        movementType = type;
        movementAmount = "";
        movementDescription = "";
        showMovementModal = true;
    }

    function closeModal() {
        showMovementModal = false;
    }

    async function submitMovement(e: Event) {
        e.preventDefault();

        const amountNum = parseFloat(movementAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert("El monto debe ser numérico y mayor a 0");
            return;
        }

        if (
            movementType === "out" &&
            amountNum > currentSession.ending_balance
        ) {
            if (
                !confirm(
                    "Aviso: Estás registrando una salida mayor al saldo restante. El cajón quedará en negativo. ¿Deseas continuar?",
                )
            )
                return;
        }

        isSubmitting = true;
        const { error } = await supabase.from("cash_movements").insert({
            session_id: currentSession.id,
            user_id: userId,
            type: movementType,
            amount: amountNum,
            description: movementDescription,
        });

        isSubmitting = false;

        if (error) {
            alert("Error al registrar movimiento: " + error.message);
        } else {
            closeModal();
            // Reload session to reflect new mathematically updated balance from SQL trigger
            await loadActiveSession();
        }
    }

    function formatMoney(amount: number) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    }

    function formatTime(dateString: string) {
        return new Date(dateString).toLocaleTimeString("es-VE", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }
</script>

<div class="container container-padding fade-in">
    {#if loading}
        <div
            style="text-align: center; padding: 40px; color: var(--text-secondary);"
        >
            Cargando Caja...
        </div>
    {:else if !currentSession}
        <!-- NO OPEN SESSION -->
        <div
            class="glass-panel"
            style="padding: 40px 24px; text-align: center; margin-top: 40px;"
        >
            <p
                style="color: var(--text-secondary); margin-bottom: 24px; font-size: 16px;"
            >
                La caja se encuentra cerrada en este momento. Debe aperturar una
                nueva jornada para comenzar a registrar.
            </p>
            <button
                class="btn btn-primary"
                style="margin: 0 auto; padding-left: 32px; padding-right: 32px;"
                on:click={openSession}
            >
                Iniciar Jornada de Caja
            </button>
        </div>
    {:else}
        <!-- SESSION OPEN -->
        <div class="glass-panel summary-card">
            <p class="summary-label">Saldo Restante</p>
            <!-- Highlight negative balances -->
            <h1
                class="glass-engraved-text"
                style="font-size: 48px; margin: 0; {currentSession.ending_balance <
                0
                    ? 'color: #ff3b30;'
                    : ''}"
            >
                {formatMoney(currentSession.ending_balance)}
            </h1>

            <div class="summary-details">
                <div class="detail-item">
                    <span class="dot in"></span>
                    <span>Ingresos</span>
                    <strong>{formatMoney(currentSession.total_in)}</strong>
                </div>
                <div class="detail-item">
                    <span class="dot out"></span>
                    <span>Egresos</span>
                    <strong>{formatMoney(currentSession.total_out)}</strong>
                </div>
            </div>

            <button class="btn close-session-btn" on:click={closeSession}>
                <Lock size={16} /> Cerrar Jornada
            </button>
        </div>

        <div class="quick-actions">
            <button
                class="btn btn-primary"
                style="flex: 1; justify-content: center; background: rgba(52, 199, 89, 0.15); color: #34c759; border: 1px solid rgba(52, 199, 89, 0.3);"
                on:click={() => openModal("in")}
            >
                <Plus size={18} style="margin-right: 6px;" /> Entrada
            </button>
            <button
                class="btn btn-primary"
                style="flex: 1; justify-content: center; background: rgba(255, 59, 48, 0.15); color: #ff3b30; border: 1px solid rgba(255,59,48,0.3);"
                on:click={() => openModal("out")}
            >
                <Minus size={18} style="margin-right: 6px;" /> Salida
            </button>
        </div>

        <h3 class="section-title">Historial de Movimientos</h3>

        {#if movements.length === 0}
            <div
                class="glass-panel"
                style="padding: 32px; text-align: center; color: var(--text-secondary);"
            >
                No hay movimientos registrados hoy.
            </div>
        {:else}
            <div class="glass-panel list-container">
                {#each movements as mov}
                    <div class="movement-item">
                        <div
                            class="mov-icon {mov.type === 'in'
                                ? 'bg-in'
                                : 'bg-out'}"
                        >
                            {#if mov.type === "in"}
                                <Plus size={16} />
                            {:else}
                                <Minus size={16} />
                            {/if}
                        </div>
                        <div class="mov-details">
                            <h4 class="mov-desc">{mov.description}</h4>
                            <span class="mov-time"
                                >{formatTime(mov.created_at)} • {mov.profiles
                                    ?.email || "Usuario"}</span
                            >
                        </div>
                        <div
                            class="mov-amount {mov.type === 'in'
                                ? 'text-in'
                                : 'text-out'}"
                        >
                            {mov.type === "in" ? "+" : "-"}{formatMoney(
                                mov.amount,
                            )}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<!-- MOVEMENT MODAL -->
{#if showMovementModal}
    <div class="modal-backdrop fade-in" on:click|self={closeModal}>
        <div class="glass-panel modal-content slide-up">
            <h2
                class="glass-engraved-text"
                style="font-size: 24px; margin-bottom: 24px; display: flex; align-items: center; gap: 8px;"
            >
                {#if movementType === "in"}
                    <div
                        class="mov-icon bg-in"
                        style="width: 32px; height: 32px;"
                    >
                        <Plus size={20} />
                    </div>
                     Registro de Entrada
                {:else}
                    <div
                        class="mov-icon bg-out"
                        style="width: 32px; height: 32px;"
                    >
                        <Minus size={20} />
                    </div>
                     Registro de Salida
                {/if}
            </h2>

            <form on:submit={submitMovement} class="admin-form">
                <div class="input-group">
                    <label class="input-label" for="amount">Monto USD ($)</label
                    >
                    <input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        class="input-field"
                        placeholder="0.00"
                        bind:value={movementAmount}
                        required
                        style="font-size: 24px; padding: 16px; font-weight: 600;"
                    />
                </div>

                <div class="input-group">
                    <label class="input-label" for="desc">Descripción</label>
                    <input
                        id="desc"
                        type="text"
                        class="input-field"
                        placeholder="Ej: Traspaso Banesco, Compra USD, Comisión..."
                        bind:value={movementDescription}
                        required
                    />
                </div>

                <div class="modal-actions" style="margin-top: 32px;">
                    <button
                        type="button"
                        class="btn btn-secondary"
                        on:click={closeModal}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        class="btn btn-primary"
                        disabled={isSubmitting}
                        style="background: {movementType === 'in'
                            ? '#34c759'
                            : '#ff3b30'}; border-color: transparent; color: white;"
                    >
                        {isSubmitting ? "Procesando..." : "Guardar Registro"}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    .summary-card {
        padding: 32px 24px;
        text-align: center;
        margin-bottom: 24px;
        position: relative;
    }

    .summary-label {
        color: var(--text-secondary);
        margin-bottom: 8px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        font-weight: 600;
    }

    .summary-details {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin-top: 16px;
        font-size: 14px;
    }

    .detail-item {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-secondary);
    }

    .detail-item strong {
        color: var(--text-primary);
        font-weight: 600;
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    .dot.in {
        background-color: #34c759;
    }
    .dot.out {
        background-color: #ff3b30;
    }

    .close-session-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        background: transparent;
        border: 1px solid var(--surface-border);
        padding: 6px 10px;
        font-size: 12px;
        gap: 6px;
    }
    .close-session-btn:hover {
        background: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
        border-color: rgba(255, 59, 48, 0.2);
    }

    .quick-actions {
        display: flex;
        gap: 12px;
        margin-bottom: 32px;
    }

    .section-title {
        margin-bottom: 16px;
        font-size: 18px;
        padding-left: 8px;
    }

    .list-container {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding: 0;
    }

    .movement-item {
        display: flex;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--surface-border);
    }
    .movement-item:last-child {
        border-bottom: none;
    }

    .mov-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
        flex-shrink: 0;
    }

    .bg-in {
        background: rgba(52, 199, 89, 0.15);
        color: #34c759;
    }
    .bg-out {
        background: rgba(255, 59, 48, 0.15);
        color: #ff3b30;
    }

    .mov-details {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .mov-desc {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .mov-time {
        font-size: 12px;
        color: var(--text-secondary);
    }

    .mov-amount {
        font-size: 16px;
        font-weight: 600;
        margin-left: 12px;
        white-space: nowrap;
        text-align: right;
    }

    .text-in {
        color: #34c759;
    }
    .text-out {
        color: #ff3b30;
    }
</style>
