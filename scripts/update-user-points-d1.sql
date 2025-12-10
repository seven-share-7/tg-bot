-- 更新用户积分 SQL 脚本
-- Telegram ID: 8314969253
-- 目标积分: 100000

UPDATE users 
SET points = 100000, 
    level = 'P5',
    updated_at = datetime('now')
WHERE telegram_id = 8314969253;

-- 验证更新结果
SELECT id, telegram_id, username, points, level, updated_at 
FROM users 
WHERE telegram_id = 8314969253;

