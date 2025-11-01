<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once '/home/ubuntu/app/zadarma-oficial/lib/Client.php';
use Zadarma_API\Client;

$key = 'd37e278f185cf3a2a8d4';
$secret = 'bba31aff4c3a03fb1605';

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['number']) || !isset($input['message'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Faltan campos requeridos']);
    exit;
}

try {
    $client = new Client($key, $secret, false);
    $response = $client->call('/v1/sms/send/', [
        'number' => $input['number'],
        'message' => $input['message']
    ], 'post', 'json');
    
    $data = json_decode($response, true);
    
    if ($data['status'] === 'success') {
        echo json_encode(['success' => true, 'data' => $data]);
    } else {
        echo json_encode(['success' => false, 'error' => $data['message']]);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
