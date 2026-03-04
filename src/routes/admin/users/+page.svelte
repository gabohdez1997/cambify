<script lang="ts">
    import { onMount } from "svelte";
    import { supabase } from "$lib/supabaseClient";
    import {
        User,
        Shield,
        ShieldAlert,
        CircleUserRound,
        Pencil,
        Plus,
    } from "lucide-svelte";

    let users: any[] = [];
    let loading = true;

    // Modal state
    let showModal = false;
    let editingUser: any = null;

    onMount(async () => {
        fetchUsers();
    });

    async function fetchUsers() {
        loading = true;
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: false });

        if (data) {
            users = data;
        }
        loading = false;
    }

    function openEditModal(user: any) {
        editingUser = { ...user };
        showModal = true;
    }

    function closeModal() {
        showModal = false;
        editingUser = null;
    }

    let newPasswordReset = "";

    async function saveUser() {
        if (!editingUser) return;

        // 1. Update Profile (Role/Status) in Database
        const { error: dbError } = await supabase
            .from("profiles")
            .update({
                role: editingUser.role,
                status: editingUser.status,
            })
            .eq("id", editingUser.id);

        if (dbError) {
            alert("Error al actualizar perfil: " + dbError.message);
            return;
        }

        // 2. Update Password if provided
        if (newPasswordReset.trim() !== "") {
            try {
                const response = await fetch("/api/admin/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "update_password",
                        targetUserId: editingUser.id,
                        newPassword: newPasswordReset,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    alert(
                        "Perfil actualizado pero falló el cambio de clave: " +
                            (data.error || "Error desconocido"),
                    );
                    return;
                }
            } catch (err) {
                alert("Error de red conectando con el servidor");
                return;
            }
        }

        fetchUsers();
        closeModal();
        newPasswordReset = "";
    }

    // CREATE USER MODAL STATE
    let showCreateModal = false;
    let newEmail = "";
    let newPassword = "";
    let newRole = "user";
    let isCreating = false;

    function handleCreateUser() {
        showCreateModal = true;
    }

    function closeCreateModal() {
        showCreateModal = false;
        newEmail = "";
        newPassword = "";
        newRole = "user";
    }

    async function executeCreateUser() {
        if (!newEmail || !newPassword) {
            alert("Por favor ingresa un correo y contraseña");
            return;
        }

        isCreating = true;

        try {
            const response = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    email: newEmail,
                    password: newPassword,
                    role: newRole,
                }),
            });

            const data = await response.json();
            isCreating = false;

            if (!response.ok) {
                alert(
                    "Error al crear usuario: " +
                        (data.error || "Error desconocido"),
                );
            } else {
                alert("Usuario creado exitosamente");
                fetchUsers();
                closeCreateModal();
            }
        } catch (err) {
            isCreating = false;
            alert("Error de red conectando con el servidor local");
        }
    }
</script>

<div class="container user-dashboard">
    <div class="header-row">
        <h1
            class="page-title"
            style="margin: 0; font-size: 24px; display: flex; align-items: center; gap: 8px;"
        >
            <User size={28} /> Usuarios
        </h1>
        <button
            class="btn btn-primary"
            style="padding: 8px 16px; font-size: 14px;"
            on:click={handleCreateUser}
        >
            <Plus size={16} style="margin-right: 4px;" /> Nuevo
        </button>
    </div>

    {#if loading}
        <p class="loading-text">Cargando usuarios...</p>
    {:else}
        <div class="users-list">
            {#each users as user}
                <div class="user-card glass-panel">
                    <div class="user-info">
                        <p
                            class="user-email"
                            style="display: flex; align-items: center; gap: 6px;"
                        >
                            <CircleUserRound
                                size={18}
                                color="var(--accent-color)"
                            />
                            {user.email}
                        </p>
                        <p
                            class="user-meta"
                            style="display: flex; align-items: center; gap: 4px; margin-top: 4px;"
                        >
                            {#if user.role === "admin"}
                                <ShieldAlert size={14} />
                            {:else}
                                <Shield size={14} />
                            {/if}
                            Rol: {user.role} • Estado:
                            <span
                                class:status-disabled={user.status ===
                                    "disabled"}>{user.status}</span
                            >
                        </p>
                    </div>
                    <button
                        class="btn btn-secondary edit-btn"
                        on:click={() => openEditModal(user)}
                        ><Pencil size={14} style="margin-right: 6px;" /> Editar</button
                    >
                </div>
            {:else}
                <p class="empty-state">No hay usuarios registrados.</p>
            {/each}
        </div>
    {/if}

    <!-- Modal -->
    {#if showModal && editingUser}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="modal-backdrop" on:click={closeModal}>
            <div class="modal-content glass-panel" on:click|stopPropagation>
                <h2
                    style="margin-bottom: 16px; font-size: 20px; display: flex; align-items: center; gap: 8px;"
                >
                    <Pencil size={20} /> Editar Usuario
                </h2>
                <p
                    style="margin-bottom: 16px; font-size: 14px; color: var(--text-secondary);"
                >
                    {editingUser.email}
                </p>

                <div class="input-group">
                    <label class="input-label" for="roleList">Rol</label>
                    <div class="input-icon-wrapper">
                        <ShieldAlert class="input-icon" size={20} />
                        <select
                            id="roleList"
                            class="input-field with-icon"
                            bind:value={editingUser.role}
                        >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                </div>

                <div class="input-group">
                    <label class="input-label" for="statusList">Estado</label>
                    <div class="input-icon-wrapper">
                        <User class="input-icon" size={20} />
                        <select
                            id="statusList"
                            class="input-field with-icon"
                            bind:value={editingUser.status}
                        >
                            <option value="active">Activo</option>
                            <option value="disabled">Deshabilitado</option>
                        </select>
                    </div>
                </div>

                <div
                    class="input-group"
                    style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--surface-border);"
                >
                    <label class="input-label" for="resetPassword"
                        >Cambiar Contraseña (Opcional)</label
                    >
                    <input
                        id="resetPassword"
                        type="text"
                        class="input-field"
                        placeholder="Dejar vacío para no cambiar"
                        bind:value={newPasswordReset}
                    />
                </div>

                <div class="modal-actions">
                    <button
                        class="btn btn-secondary"
                        style="flex: 1;"
                        on:click={closeModal}>Cancelar</button
                    >
                    <button
                        class="btn btn-primary"
                        style="flex: 1;"
                        on:click={saveUser}>Guardar</button
                    >
                </div>
            </div>
        </div>
    {/if}

    <!-- Create Modal -->
    {#if showCreateModal}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="modal-backdrop" on:click={closeCreateModal}>
            <div class="modal-content glass-panel" on:click|stopPropagation>
                <h2
                    style="margin-bottom: 24px; font-size: 20px; display: flex; align-items: center; gap: 8px;"
                >
                    <Plus size={20} /> Nuevo Usuario
                </h2>

                <div class="input-group">
                    <label class="input-label" for="newEmail"
                        >Correo Electrónico</label
                    >
                    <input
                        id="newEmail"
                        type="email"
                        class="input-field"
                        placeholder="usuario@ejemplo.com"
                        bind:value={newEmail}
                    />
                </div>

                <div class="input-group">
                    <label class="input-label" for="newPassword"
                        >Contraseña</label
                    >
                    <input
                        id="newPassword"
                        type="password"
                        class="input-field"
                        placeholder="Mínimo 6 caracteres"
                        bind:value={newPassword}
                    />
                </div>

                <div class="input-group">
                    <label class="input-label" for="newRoleList"
                        >Rol Inicial</label
                    >
                    <div class="input-icon-wrapper">
                        <ShieldAlert class="input-icon" size={20} />
                        <select
                            id="newRoleList"
                            class="input-field with-icon"
                            bind:value={newRole}
                        >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                </div>

                <div class="modal-actions">
                    <button
                        class="btn btn-secondary"
                        style="flex: 1;"
                        disabled={isCreating}
                        on:click={closeCreateModal}>Cancelar</button
                    >
                    <button
                        class="btn btn-primary"
                        style="flex: 1;"
                        disabled={isCreating}
                        on:click={executeCreateUser}
                    >
                        {isCreating ? "Creando..." : "Crear"}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    }

    .loading-text,
    .empty-state {
        text-align: center;
        color: var(--text-secondary);
        margin-top: 32px;
    }

    .users-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .user-card {
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .user-email {
        font-weight: 600;
        font-size: 16px;
        margin-bottom: 4px;
    }

    .user-meta {
        font-size: 13px;
        color: var(--text-secondary);
    }

    .status-disabled {
        color: #ff3b30;
        font-weight: 500;
    }

    .edit-btn {
        padding: 6px 12px;
        font-size: 13px;
    }

    /* Modal Styles */
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
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
        max-width: 400px;
        padding: 24px;
        /* Using the global glass-panel but ensuring opacity is fully visible */
        background: var(--bg-color);
    }

    .modal-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
    }
</style>
