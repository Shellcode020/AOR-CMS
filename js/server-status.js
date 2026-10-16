
(() => {
    const apiUrl = '/api/status.php';
    const refreshInterval = 30000;

    const get = (id) => document.getElementById(id);

    function setText(id, value) {
        const element = get(id);
        if (element) element.textContent = value;
    }

    function formatTime(value) {
        if (!value) return '—';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';

        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function formatUptime(totalSeconds) {
        if (
            totalSeconds == null ||
            !Number.isFinite(Number(totalSeconds))
        ) {
            return 'Not available';
        }

        let seconds = Math.max(
            0,
            Math.floor(Number(totalSeconds))
        );

        const days = Math.floor(seconds / 86400);
        seconds %= 86400;

        const hours = Math.floor(seconds / 3600);
        seconds %= 3600;

        const minutes = Math.floor(seconds / 60);

        const parts = [];

        if (days > 0) {
            parts.push(
                `${days} ${days === 1 ? 'day' : 'days'}`
            );
        }

        if (hours > 0) {
            parts.push(
                `${hours} ${hours === 1 ? 'hour' : 'hours'}`
            );
        }

        if (minutes > 0) {
            parts.push(
                `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
            );
        }

        if (parts.length === 0) {
            return 'Less than a minute';
        }

        return parts.join(', ');
    }

    function setStatus(online) {
        const statusText = get('server-status-text');

        if (statusText) {
            statusText.classList.remove(
                'status-badge-online',
                'status-badge-offline'
            );

            statusText.classList.add(
                online
                    ? 'status-badge-online'
                    : 'status-badge-offline'
            );

            statusText.textContent = online ? 'Online' : 'Offline';
        }

        const pill = get('server-status-pill');
        const dot = get('server-status-dot');

        if (pill) {
            pill.classList.toggle('is-online', online);
            pill.classList.toggle('is-offline', !online);
        }

        if (dot) {
            dot.classList.toggle('is-online', online);
            dot.classList.toggle('is-offline', !online);
        }

        const message = get('status-message');

        if (message) {
            message.textContent = online
                ? 'Anarchy Online game server is responding.'
                : 'The game server is currently unreachable.';
        }
        // Update the homepage's main server indicator.
        const homeIndicator = get('server-status-indicator');

        if (homeIndicator) {
            homeIndicator.classList.toggle('is-online', online);
            homeIndicator.classList.toggle('is-offline', !online);
            homeIndicator.setAttribute(
                'aria-label',
                online ? 'Server online' : 'Server offline'
            );
        }
    }

    async function updateServerStatus() {
        try {
            const response = await fetch(apiUrl, {
                cache: 'no-store'
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error('Status API unavailable');
            }

            setStatus(data.server_online === true);

            setText(
                'server-connection',
                data.connection ?? 'Unknown'
            );

            setText(
                'server-uptime',
                data.uptime_seconds == null
                    ? 'Server is offline'
                    : formatUptime(data.uptime_seconds)
            );

            setText(
                'server-latency',
                data.latency_ms == null
                    ? '—'
                    : `${data.latency_ms} ms`
            );

            setText('server-accounts', data.accounts ?? '—');
            setText('server-characters', data.characters ?? '—');
            setText('server-players-online', data.players_online ?? '—');
            setText('server-last-updated', formatTime(data.checked_at));

        } catch (error) {
            setStatus(false);
            setText('server-connection', 'Unavailable');
            setText('server-uptime', 'Unavailable');
            setText('server-latency', '—');
            setText('server-accounts', '—');
            setText('server-characters', '—');
            setText('server-players-online', '—');
            setText('server-last-updated', 'Update failed');

            console.error('AO Rebirth status error:', error);
        }
    }

    updateServerStatus();
    window.setInterval(updateServerStatus, refreshInterval);
})();
