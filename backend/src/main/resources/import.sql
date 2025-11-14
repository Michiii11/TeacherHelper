insert into app_user (username, email, password) values
('admin', 'admin@admin', '$2a$10$Rp61DZDWDgUwUObAkBxfYueUfvrDidwM5lILMCJ.WyiTMYonnGQKi'),
('user', 'user@user', '$2a$10$Rp61DZDWDgUwUObAkBxfYueUfvrDidwM5lILMCJ.WyiTMYonnGQKi');

insert into School (name, admin_id) values
('Springfield High', 1),
('Shelbyville High', 2),
('Ogdenville High', 2);

-- Examples (IDs explizit gesetzt, damit Collection-Tabellen referenzieren können)
insert into Example (id, instruction, question, difficulty, answer, imageUrl, admin_id, school_id, gapFillType) values
(1, 'Wähle die richtige Antwort', 'What is 2 + 2?', 'LEICHT', null, null, 1, 1, null),
(2, 'Fülle die Lücken (Mehrfachauswahl)', 'Das ___ Beispiel ist ___ .', 'MITTEL', null, null, 1, 1, 'SELECT'),
(3, 'Ordne zu', 'Ordne die linken Begriffe den richtigen rechts zu.', 'SCHWER', null, null, 1, 2, null);

-- example_options für Beispiel 1 (Multiple Choice)
insert into example_options (example_id, text, is_correct) values
(1, '3', false),
(1, '4', true),
(1, '5', false);

-- example_answers falls nötig (z.B. als zusätzliche Antwortenliste)
insert into example_answers (example_id, answer) values
(1, '4');

-- Gaps für Beispiel 2
insert into example_gaps (id, label, example_id) values
(1, 'Lücke1', 2),
(2, 'Lücke2', 2);

-- Optionen für die Gaps (gap_options)
insert into gap_options (gap_id, text, is_correct) values
(1, 'ein', false),
(1, 'einfaches', true),
(2, 'kleines', true),
(2, 'großes', false);

-- Beispiel 3: Assigns (links/rechts Paare)
insert into example_assigns (example_id, left_item, right_item) values
(3, 'Hund', 'Dog'),
(3, 'Katze', 'Cat'),
(3, 'Haus', 'House');

-- Rechte Items (separat in example_assign_right_items)
insert into example_assign_right_items (example_id, right_item) values
(3, 'Dog'),
(3, 'Cat'),
(3, 'House');