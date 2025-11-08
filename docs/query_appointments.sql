SELECT 
    status,
    COUNT(*) as total
FROM appointments
GROUP BY status
ORDER BY total DESC;
