-- Transfer all time entries from "Marketing Larin" to "Giuseppe Musicco"
UPDATE activity_time_tracking 
SET user_id = '29dbd20e-94c3-4e90-99ca-6f5581747331'
WHERE user_id = 'fd9221cb-74fe-468d-8064-9fbb11f6b1ca';