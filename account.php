<?php
declare(strict_types=1);

ini_set('session.use_strict_mode', '1');

session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);

session_start();
header('Cache-Control: no-store');

if (
    empty($_SESSION['account_id']) ||
    empty($_SESSION['account_username'])
) {
    header('Location: index.html');
    exit;
}

try {
    $config = require __DIR__ . '/api/config.php';
    $d = $config['database'];

    $pdo = new PDO(
        sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $d['host'],
            (int) $d['port'],
            $d['name']
        ),
        $d['username'],
        $d['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $q = $pdo->prepare(
        'SELECT Id, Username, Email, FirstName, LastName, CreationDate, GM
         FROM login
         WHERE Id = :id AND Username = :username
         LIMIT 1'
    );

    $q->execute([
        'id' => (int) $_SESSION['account_id'],
        'username' => (string) $_SESSION['account_username'],
    ]);

    $account = $q->fetch();

    if (!$account) {
        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();

            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]);
        }

        session_destroy();
        header('Location: index.html');
        exit;
    }

    $q = $pdo->prepare(
        'SELECT Id, Name, FirstName, LastName, playfield, Online
         FROM characters
         WHERE Username = :username
         ORDER BY Name'
    );

    $q->execute([
        'username' => (string) $account['Username'],
    ]);

    $characters = $q->fetchAll();

} catch (Throwable $e) {
    error_log('[Anarchy Online account page] ' . $e->getMessage());
    http_response_code(500);
    exit('The account panel could not load. Please check the server error log.');
}

function h(mixed $v): string
{
    return htmlspecialchars(
        (string) $v,
        ENT_QUOTES | ENT_SUBSTITUTE,
        'UTF-8'
    );
}

/* Display-friendly names for character playfield IDs. */
$playfieldNames = [
    760 => '4 Holes',
	127 => 'Subway',
    4873 => 'Adonis Abyss',
    4872 => 'Adonis City',
    4877 => 'Adonis Hallway',
    585 => 'Aegean',
    4336 => 'Alappaa',
    4337 => 'Albtraum',
    4374 => 'Alien Playfield - Sector 10',
    4365 => 'Alien Playfield - Sector 13',
    4366 => 'Alien Playfield - Sector 28',
    4367 => 'Alien Playfield - Sector 35',
    4370 => 'Alien Playfield - Sector 42',
    6011 => 'Arid Rift',
    655 => 'Andromeda (ICC)',
    550 => 'Athen Shire',
    505 => 'Avalon',
    660 => 'Bay of Rome',
    605 => 'Belial Forest',
    800 => 'Borealis',
    510 => 'Broken Crest',
    665 => 'Broken Shores',
    4005 => 'Burning Marshes',
    4689 => "Cama's Sanctuary",
    120 => 'Camelot Castle',
    590 => 'Central Artery Valley',
    6013 => 'Central Gateway',
    670 => 'Clondyke',
    556 => 'Coast of Peace',
    656 => 'Coast of Tranquility',
    4687 => "Dalja's Sanctuary",
    595 => 'Deep Artery Valley',
    555 => 'Dry Wastes',
    4543 => 'East of Elysium',
    620 => 'Eastern Fouls Plain',
    4542 => 'Elysium',
    4679 => "Enel's Sanctuary",
    685 => 'Galway Country',
    687 => 'Galway Shire',
    765 => 'Gangly Mountains',
    4676 => 'Garden of Aban',
    4688 => 'Garden of Cama',
    4686 => 'Garden of Dalja',
    4678 => 'Garden of Enel',
    4684 => 'Garden of Gilthar',
    4692 => 'Garden of Lord Galahad',
    4694 => 'Garden of Lord Mordeth',
    4682 => 'Garden of Ocra',
    4696 => 'Garden of Redeemed Pandemonium',
    4683 => 'Garden of Roch',
    4680 => 'Garden of Shere',
    4677 => 'Garden of Thrak',
    4697 => 'Garden of Unredeemed Pandemonium',
    4690 => 'Garden of Vanja',
    4685 => "Gilthar's Sanctuary",
    770 => 'Great Cathedral Park',
    717 => 'Greater Omni Forest',
    647 => 'Greater Tir County',
    152 => 'Grid',
    791 => 'Holes in the Wall',
    4582 => 'ICC Shuttleport',
    4605 => 'Inferno',
    690 => 'Jobe',
    4560 => 'Jobe Gateway',
    4531 => 'Jobe Harbour',
    4532 => 'Jobe Market',
    4530 => 'Jobe Platform',
    4533 => 'Jobe Plaza',
    4001 => 'Jobe Research',
    4313 => 'Jobe Training Biosphere',
    775 => 'Kapar',
    4693 => "Lord Galahad's Sanctuary",
    4695 => "Lord Mordeth's Sanctuary",
    4881 => 'Lower Scheol',
    695 => 'Lush Fields',
    625 => 'Milky Way',
    560 => 'Mort',
    696 => 'Mutant Domain',
    4310 => 'Nascence Frontier',
    4312 => 'Nascence Swamp',
    4311 => 'Nascence Wilds',
    780 => 'Nebula Mountains',
    567 => 'Newland',
    566 => 'Newland City',
    565 => 'Newland Desert',
    4544 => 'North of Elysium',
    4698 => "Ocra's Sanctuary",
    540 => 'Old Athen City',
    705 => 'Omni-1 Entertainment',
    716 => 'Omni-1 Forest',
    700 => 'Omni-1 Headquarters',
    710 => 'Omni-1 Trade',
    4329 => 'Pandemonium Antenora',
    4328 => 'Pandemonium Caina',
    4331 => 'Pandemonium Judecca',
    4330 => 'Pandemonium Ptolemea',
    4006 => 'Penumbra',
    4629 => 'Penumbra',
    4320 => 'Penumbra Forest',
    4322 => 'Penumbra Hollows',
    4321 => 'Penumbra Valley',
    570 => 'Perpetual Wastelands',
    720 => 'Plains of Divaad',
    575 => 'Plains of Salt',
    630 => 'Pleasant Meadows',
    725 => 'Reck Peninsula',
    785 => 'Road to Kapar',
    4699 => "Roch's Sanctuary",
    735 => 'Rome Blue District',
    740 => 'Rome Green District',
    730 => 'Rome Red District',
    520 => 'Sandsend',
    745 => 'Sea of Jobe',
    4681 => "Shere's Sanctuary",
    4540 => 'South of Elysium',
    610 => 'Southern Artery Valley',
    615 => 'Southern Fouls Hills',
    525 => 'Sparta',
    1933 => 'Steps of Madness Dungeon',
    635 => 'Stret East Bank',
    790 => 'Stret West Bank',
    535 => 'The Big One',
    515 => 'The Endless Plains',
    795 => 'The Longest Road',
    750 => 'The Reck',
    755 => 'The Spur',
    580 => 'Three Craters',
    640 => 'Tir City',
    646 => 'Tir County',
    4364 => 'Unicorn Outpost',
    4368 => 'Unicorn Outpost - Lower level',
    4880 => 'Upper Scheol',
    650 => 'Upper Stret East Bank',
    4691 => "Vanja's Sanctuary",
    600 => 'Varmint Woods',
    551 => 'Wailing Wastes',
    586 => 'Wartorn Valley',
    545 => 'West Athen City',
    4541 => 'West of Elysium',
];

function playfieldName(mixed $id, array $names): string
{
    $id = (int) $id;
    return $names[$id] ?? ('Unknown playfield (' . $id . ')');
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>Anarchy Online | Secure Player Area</title>
    <meta name="theme-color" content="#080b10">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Exo+2:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
    >

    <link rel="stylesheet" href="css/site.css">
    <link rel="stylesheet" href="css/guides.css">
    <link rel="stylesheet" href="css/interior-pages.css">
    <link rel="stylesheet" href="css/account-panel.css">

    <script src="js/site.js" defer></script>
    <script src="js/account-panel.js" defer></script>
    <script src="js/account-navigation.js" defer></script>
</head>

<body>

<div id="site-navigation"></div>

<nav
    class="mobile-nav"
    id="mobileNav"
    aria-label="Mobile navigation"
    aria-hidden="true"
>
    <div class="mobile-nav-header">
        <a href="index.html" class="logo">
            <span class="logo-mark">
                <img src="assets/img/logo.png" alt="">
            </span>
            <span class="logo-wording">
                Anarchy Online
                <span class="sub">Private Server</span>
            </span>
        </a>

        <button
            class="icon-btn"
            id="closeBtn"
            type="button"
            aria-label="Close menu"
        >
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
            >
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        </button>
    </div>

    <a href="index.html#home">Home</a>
    <a href="index.html#news">News</a>
    <a href="index.html#status">Download</a>
    <a href="index.html#support">Support</a>
    <a href="index.html#discord">Discord</a>

    <button
        class="btn-login account-logout"
        id="logout-button-mobile"
        type="button"
    >Log out ↗</button>
</nav>

<!-- Hero: retain the same styling as the Guides page. -->
<section class="guides-hero account-hero">
    <div class="guides-hero-inner account-hero-inner">
        <p class="hero-label">SECURE PLAYER AREA</p>
        <h1>Welcome back, <?= h($account['FirstName']) ?>.</h1>
        <p>Manage your account and your journey across Rubi-Ka.</p>
    </div>
</section>

<main class="shell account-shell">
    <div class="layout">

        <!-- ACCOUNT SIDEBAR -->
        <aside class="expansion-sidebar">

            <!-- ACCOUNT DETAILS HEADER -->
            <div class="account-welcome-box">
                <span class="account-welcome-label">
                    ACCOUNT DETAILS
                </span>
            </div>

            <!-- ACCOUNT INFORMATION -->
            <div class="account-information">

                <div class="account-info-row">
                    <span class="account-info-label">
                        Account Name
                    </span>
                    <strong class="account-info-value">
                        <?= h($account['Username']) ?>
                    </strong>
                </div>

                <div class="account-info-row">
                    <span class="account-info-label">
                        Account Type
                    </span>
                    <strong class="account-info-value account-type-badge">
                        <?= (int) ($account['GM'] ?? 0) > 0
                            ? 'GM'
                            : 'PLAYER' ?>
                    </strong>
                </div>

                <div class="account-info-row">
                    <span class="account-info-label">
                        Account Status
                    </span>
                    <strong class="account-info-value account-active-status">
                        <span
                            class="online-dot"
                            aria-hidden="true"
                        ></span>
                        Active
                    </strong>
                </div>

            </div>

            <!-- ACCOUNT MENU --><div class="account-card-divider"></div>
<div class="account-welcome-box">
    <span class="account-welcome-label">ACCOUNT MENU</span>
</div>

            <!-- ACCOUNT NAVIGATION LINKS -->
            <div class="expansion-links">

                <a class="expansion-link active" href="#characters">
                    <span>Characters</span>
                    <span class="expansion-arrow">›</span>
                </a>

                <a class="expansion-link" href="#details">
                    <span>Account Details</span>
                    <span class="expansion-arrow">›</span>
                </a>

                <a class="expansion-link" href="#password">
                    <span>Change Password</span>
                    <span class="expansion-arrow">›</span>
                </a>

            </div>

            <!-- SIDEBAR FOOTER -->
       
        </aside>

        <!-- ACCOUNT CONTENT -->
        <div class="content">

            <!-- CHARACTERS -->
            <section class="panel" id="characters">
                <div class="section-heading">
                    <div>
                       <p class="account-section-label">YOUR ROSTER</p>
                        <h2>My Characters</h2>
                    </div>

                    <span class="character-count">
                        <strong><?= count($characters) ?></strong>
                        <span>characters found</span>
                    </span>
                </div>

                <p class="muted">
                    Log the character out of the game before using unstuck.
                </p>

                <?php if (!$characters): ?>
                    <div class="empty">
                        No characters are linked to this account yet.
                    </div>
                <?php else: ?>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Character Name</th>
                                    <th>Location</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <?php foreach ($characters as $c): ?>
                                    <?php
                                    $isOnline = (int) ($c['Online'] ?? 0) !== 0;
                                    ?>

                                    <tr>
                                        <td>
                                            <strong class="character-name">
                                                <?= h($c['Name']) ?>
                                            </strong>
                                            <small>
                                                <?= h(trim(
                                                    (string) $c['FirstName'] . ' ' .
                                                    (string) $c['LastName']
                                                )) ?>
                                            </small>
                                        </td>

                                        <td>
                                            <?= h(playfieldName(
                                                $c['playfield'],
                                                $playfieldNames
                                            )) ?>
                                        </td>

                                        <td>
                                            <span class="state <?= $isOnline ? 'is-online' : '' ?>">
                                                <?= $isOnline ? 'Online' : 'Offline' ?>
                                            </span>
                                        </td>

                                        <td>
                                            <button
                                                class="unstuck-button"
                                                type="button"
                                                data-character-id="<?= (int) $c['Id'] ?>"
                                                data-character-name="<?= h($c['Name']) ?>"
                                                <?= $isOnline ? 'disabled' : '' ?>
                                            >
                                                <span aria-hidden="true">↗</span>
                                                Unstuck
                                            </button>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>

                <p
                    class="notice"
                    id="character-message"
                    role="status"
                    aria-live="polite"
                ></p>
            </section>

            <!-- ACCOUNT DETAILS -->
			        
            <section class="panel" id="details">
    
                <div class="section-heading">
                    <div>
                       <p class="account-section-label">Account Details</p>
                        <h2>My Information</h2>
                    </div></div>

                <form id="profile-form" class="form-grid">
                    <label>
                        Username
                        <input
                            value="<?= h($account['Username']) ?>"
                            disabled
                        >
                    </label>

                    <label>
                        Email Address
                        <input
                            type="email"
                            name="email"
                            maxlength="64"
                            required
                            value="<?= h($account['Email']) ?>"
                        >
                    </label>

                    <label>
                        First Name
                        <input
                            name="first_name"
                            maxlength="32"
                            required
                            value="<?= h($account['FirstName']) ?>"
                        >
                    </label>

                    <label>
                        Last Name
                        <input
                            name="last_name"
                            maxlength="32"
                            required
                            value="<?= h($account['LastName']) ?>"
                        >
                    </label>

                    <div class="form-actions">
                        <button class="primary" type="submit">
                            Save Details
                        </button>

                        <span
                            class="notice"
                            id="profile-message"
                            role="status"
                            aria-live="polite"
                        ></span>
                    </div>
                </form>
            </section>

            <!-- CHANGE PASSWORD -->
            <section class="panel" id="password">
                <div class="section-heading">
                    <div>
                       <p class="account-section-label">Security</p>
                        <h2>Change Password</h2>
                    </div></div>


                <div class="password-security-warning" role="note">
                    <strong>🔒 SECURITY WARNING</strong>
                    <p>
                        Your password is strictly confidential. Our staff will
                        never ask you to disclose your password. Never share
                        it with anyone.
                    </p>
                </div>

                <form id="password-form" class="form-grid">
                    <label class="full">
                        Current Password
                        <input
                            type="password"
                            name="current_password"
                            autocomplete="current-password"
                            required
                        >
                    </label>

                    <label>
                        New Password
                        <input
                            type="password"
                            name="new_password"
                            minlength="6"
                            maxlength="128"
                            autocomplete="new-password"
                            required
                        >
                    </label>

                    <label>
                        Confirm New Password
                        <input
                            type="password"
                            name="confirm_password"
                            minlength="6"
                            maxlength="128"
                            autocomplete="new-password"
                            required
                        >
                    </label>

                    <div class="form-actions">
                        <button class="primary" type="submit">
                            Update Password
                        </button>

                        <span
                            class="notice"
                            id="password-message"
                            role="status"
                            aria-live="polite"
                        ></span>
                    </div>
                </form>
            </section>

        </div>
    </div>
</main>

<div id="site-footer"></div>

<script src="js/shared-layout.js" defer></script>
<script src="js/account-navigation.js" defer></script>
</body>
</html>
