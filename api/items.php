<?php
declare(strict_types=1);

/*
 * Anarchy Online - Item Database API
 * Website made by Shellcode (Discord: shell.code) 
 * Database: C:\xampp\htdocs\assets\database\items.sqlite
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

function api_response(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES |
        JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}

function get_database(): PDO
{
    $path = __DIR__ . '/../assets/database/items.sqlite';

    if (!is_file($path)) {
        api_response([
            'ok' => false,
            'error' => 'The item database was not found.'
        ], 503);
    }

    return new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
}

function get_item_count(PDO $db): int
{
    return (int)$db->query(
        'SELECT COUNT(*) FROM items'
    )->fetchColumn();
}

function get_integer(
    string $key,
    int $default,
    int $min,
    int $max
): int {
    $value = $_GET[$key] ?? null;

    if (!is_scalar($value) ||
        !preg_match('/^\d+$/', (string)$value)) {
        return $default;
    }

    return max($min, min($max, (int)$value));
}

function get_item_tags(array $item): array
{
    $stats = $item['stats'] ?? $item['Stats'] ?? [];
    $flags = (int)($stats['None'] ?? $stats['none'] ?? 0);
    $flags &= 0xFFFFFFFF;

    $tags = [];

    if (($flags & 0x04000000) !== 0) {
        $tags[] = 'NoDrop';
    }

    if (($flags & 0x08000000) !== 0) {
        $tags[] = 'Unique';
    }

    if ((int)($stats['ItemRarity'] ?? $stats['itemrarity'] ?? 0) === 3) {
        $tags[] = 'Special';
    }

    return $tags;
}

function collect_side_criteria(array $data, array &$matches): void
{
    foreach ($data as $key => $value) {
        if ($key === 'Criteria' && is_array($value)) {
            foreach ($value as $criterion) {
                if (!is_array($criterion)) {
                    continue;
                }

                if (!isset(
                    $criterion['Value1'],
                    $criterion['Value2'],
                    $criterion['Operator']
                )) {
                    continue;
                }

                if ((int)$criterion['Value1'] !== 33) {
                    continue;
                }

                $side = (int)$criterion['Value2'];
                $operator = (int)$criterion['Operator'];

                if (in_array($side, [0, 1, 2], true) &&
                    in_array($operator, [0, 24], true)) {
                    $matches[] = [
                        'side' => $side,
                        'operator' => $operator
                    ];
                }
            }

            continue;
        }

        if (is_array($value)) {
            collect_side_criteria($value, $matches);
        }
    }
}

function get_item_side(array $item): ?string
{
    $actionData = $item['action_data']
        ?? $item['ActionData']
        ?? [];

    if (!is_array($actionData)) {
        return null;
    }

    $matches = [];
    collect_side_criteria($actionData, $matches);

    if (!$matches) {
        return null;
    }

    $sideNames = [
        0 => 'Neutral',
        1 => 'Clan',
        2 => 'Omni'
    ];

    foreach ($matches as $match) {
        if ($match['operator'] === 0) {
            return 'Side: ' . $sideNames[$match['side']];
        }
    }

    foreach ($matches as $match) {
        if ($match['operator'] === 24) {
            return 'Not ' . $sideNames[$match['side']];
        }
    }

    return null;
}

/**
 * Return the actual database records available for an item's QLs.
 */
function get_item_variants(PDO $db, string $name): array
{
    $stmt = $db->prepare(
        'SELECT id, name, level, min_damage, max_damage
         FROM items
         WHERE name = :name COLLATE NOCASE
         ORDER BY level ASC, id ASC'
    );

    $stmt->execute([':name' => $name]);

    $variants = $stmt->fetchAll();

    foreach ($variants as &$variant) {
        $variant['id'] = (int)$variant['id'];
        $variant['level'] = $variant['level'] === null
            ? null
            : (int)$variant['level'];
    }
    unset($variant);

    return $variants;
}

/**
 * Build a safe FTS5 query for word-prefix searches.
 */
function make_fts_query(string $query): string
{
    $tokens = preg_split('/\s+/u', $query, -1, PREG_SPLIT_NO_EMPTY);
    $terms = [];

    foreach (array_slice($tokens ?: [], 0, 8) as $token) {
        $token = preg_replace('/[^\p{L}\p{N}_-]/u', '', $token);

        if ($token !== '') {
            $terms[] = '"' . $token . '"*';
        }
    }

    return implode(' AND ', $terms);
}

try {
    $db = get_database();
    $totalItems = get_item_count($db);

    if (isset($_GET['health'])) {
        api_response([
            'ok' => true,
            'database_count' => $totalItems
        ]);
    }

    /*
     * Detail endpoint:
     * /api/items.php?id=246663
     * /api/items.php?id=246663&ql=300
     *
     * When QL is supplied, load the real record for that QL.
     */
    if (isset($_GET['id'])) {
        $rawId = (string)$_GET['id'];

        if (!preg_match('/^\d+$/', $rawId)) {
            api_response([
                'ok' => false,
                'error' => 'Invalid item ID.'
            ], 400);
        }

        $stmt = $db->prepare(
            'SELECT id, name, record_json
             FROM items
             WHERE id = :id
             LIMIT 1'
        );

        $stmt->execute([':id' => (int)$rawId]);
        $row = $stmt->fetch();

        if (!$row) {
            api_response([
                'ok' => false,
                'error' => 'Item not found.'
            ], 404);
        }

        $requestedQl = null;

        if (isset($_GET['ql']) && $_GET['ql'] !== '') {
            $rawQl = (string)$_GET['ql'];

            if (!preg_match('/^\d{1,3}$/', $rawQl)) {
                api_response([
                    'ok' => false,
                    'error' => 'Invalid QL.'
                ], 400);
            }

            $requestedQl = (int)$rawQl;
        }

        if ($requestedQl !== null) {
            $variantStmt = $db->prepare(
                'SELECT id, name, record_json
                 FROM items
                 WHERE name = :name COLLATE NOCASE
                   AND level = :level
                 ORDER BY
                   CASE WHEN id = :original_id THEN 0 ELSE 1 END,
                   id ASC
                 LIMIT 1'
            );

            $variantStmt->execute([
                ':name' => $row['name'],
                ':level' => $requestedQl,
                ':original_id' => (int)$row['id']
            ]);

            $selected = $variantStmt->fetch();

            if (!$selected) {
                api_response([
                    'ok' => false,
                    'error' => 'That QL is not available for this item.',
                    'available_variants' => get_item_variants(
                        $db,
                        $row['name']
                    )
                ], 404);
            }

            $row = $selected;
        }

        $item = json_decode($row['record_json'], true);

        if (!is_array($item)) {
            api_response([
                'ok' => false,
                'error' => 'Could not read the item record.'
            ], 500);
        }

        $variants = get_item_variants($db, $row['name']);

        $item['id'] = (int)$row['id'];
        $item['tags'] = get_item_tags($item);
        $item['side'] = get_item_side($item);

        api_response([
            'ok' => true,
            'database_count' => $totalItems,
            'item' => $item,
            'variants' => $variants,
            'available_qls' => array_values(array_unique(
                array_map(
                    static fn(array $v) => $v['level'],
                    array_filter(
                        $variants,
                        static fn(array $v) => $v['level'] !== null
                    )
                )
            ))
        ]);
    }

    /*
     * Search:
     * /api/items.php?q=JAME
     * /api/items.php?q=246663
     * /api/items.php?q=JAME&ql=300
     *
     * Results are grouped by item name. The representative record
     * is the lowest matching QL; a QL filter selects that QL first.
     */
    $query = trim((string)($_GET['q'] ?? ''));
    $query = mb_substr($query, 0, 120, 'UTF-8');

    $ql = null;

    if (isset($_GET['ql']) && $_GET['ql'] !== '') {
        $rawQl = (string)$_GET['ql'];

        if (preg_match('/^\d{1,3}$/', $rawQl)) {
            $ql = (int)$rawQl;
        }
    }

    $limit = get_integer('limit', 30, 1, 100);
    $offset = get_integer('offset', 0, 0, 10000000);

    if ($query === '' && $ql === null) {
        api_response([
            'ok' => true,
            'database_count' => $totalItems,
            'total' => 0,
            'limit' => $limit,
            'offset' => $offset,
            'items' => []
        ]);
    }

    $where = [];
    $params = [];

    if ($query !== '') {
        if (ctype_digit($query)) {
            $where[] = '(id = :exact_id OR name LIKE :name)';
            $params[':exact_id'] = (int)$query;
            $params[':name'] = '%' . $query . '%';
        } else {
            $ftsQuery = make_fts_query($query);

            if ($ftsQuery !== '') {
                $where[] = 'id IN (
                    SELECT CAST(id AS INTEGER)
                    FROM items_fts
                    WHERE items_fts MATCH :fts
                )';
                $params[':fts'] = $ftsQuery;
            } else {
                $where[] = 'name LIKE :name';
                $params[':name'] = '%' . $query . '%';
            }
        }
    }

    if ($ql !== null) {
        $where[] = 'level = :ql';
        $params[':ql'] = $ql;
    }

    $whereSql = $where
        ? 'WHERE ' . implode(' AND ', $where)
        : '';

    $countSql = '
        SELECT COUNT(DISTINCT name COLLATE NOCASE)
        FROM items
        ' . $whereSql;

    $countStmt = $db->prepare($countSql);

    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }

    $countStmt->execute();
    $matchingCount = (int)$countStmt->fetchColumn();

    /*
     * Fallback for fragments inside words that FTS cannot find.
     */
    if ($query !== '' &&
        !ctype_digit($query) &&
        $matchingCount === 0) {
        $where = ['name LIKE :name'];
        $params = [':name' => '%' . $query . '%'];

        if ($ql !== null) {
            $where[] = 'level = :ql';
            $params[':ql'] = $ql;
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);

        $countStmt = $db->prepare(
            'SELECT COUNT(DISTINCT name COLLATE NOCASE)
             FROM items ' . $whereSql
        );

        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value);
        }

        $countStmt->execute();
        $matchingCount = (int)$countStmt->fetchColumn();
    }

    /*
     * Select one representative record per name.
     * All QL versions remain available through the detail endpoint.
     */
    $sql = '
        SELECT
            id,
            name,
            description,
            level,
            icon,
            item_class,
            slot,
            min_damage,
            max_damage,
            record_json
        FROM (
            SELECT
                id,
                name,
                description,
                level,
                icon,
                item_class,
                slot,
                min_damage,
                max_damage,
                record_json,
                ROW_NUMBER() OVER (
                    PARTITION BY name COLLATE NOCASE
                    ORDER BY level ASC, id ASC
                ) AS row_number
            FROM items
            ' . $whereSql . '
        )
        WHERE row_number = 1
        ORDER BY name COLLATE NOCASE ASC, level ASC, id ASC
        LIMIT :limit OFFSET :offset
    ';

    $stmt = $db->prepare($sql);

    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }

    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $items = $stmt->fetchAll();

    foreach ($items as &$searchItem) {
        $record = json_decode(
            $searchItem['record_json'] ?? '',
            true
        );

        if (is_array($record)) {
            $searchItem['tags'] = get_item_tags($record);
            $searchItem['side'] = get_item_side($record);
        } else {
            $searchItem['tags'] = [];
            $searchItem['side'] = null;
        }

        $variants = get_item_variants($db, $searchItem['name']);

        $searchItem['available_qls'] = array_values(array_unique(
            array_map(
                static fn(array $v) => $v['level'],
                array_filter(
                    $variants,
                    static fn(array $v) => $v['level'] !== null
                )
            )
        ));

        $searchItem['min_level'] = $variants
            ? min(array_column($variants, 'level'))
            : null;

        $searchItem['max_level'] = $variants
            ? max(array_column($variants, 'level'))
            : null;

        $searchItem['variant_count'] = count($variants);

        unset($searchItem['record_json']);
    }

    unset($searchItem);

    api_response([
        'ok' => true,
        'database_count' => $totalItems,
        'total' => $matchingCount,
        'limit' => $limit,
        'offset' => $offset,
        'items' => $items
    ]);

} catch (Throwable $e) {
    error_log('Anarchy Online Items API: ' . $e->getMessage());

    api_response([
        'ok' => false,
        'error' => 'The item database request failed. Check the PHP error log.'
    ], 500);
}
?>
