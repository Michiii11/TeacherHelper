insert into app_user (
    username,
    email,
    password,
    subscription_model,
    email_verified,
    allow_invitations,
    deleted,
    profile_image_url
) values
      (
          'admin',
          'admin@admin',
          '$2a$10$Rp61DZDWDgUwUObAkBxfYueUfvrDidwM5lILMCJ.WyiTMYonnGQKi',
          'ADMIN',
          true,
          true,
          false,
       'users/1/avatar/current.jpg'
      ),
      (
          'user',
          'user@user',
          '$2a$10$Rp61DZDWDgUwUObAkBxfYueUfvrDidwM5lILMCJ.WyiTMYonnGQKi',
          'FREE',
          true,
          true,
          false,
          'users/2/avatar/current.jpg'
      );


insert into School (name, admin_id) values
('Springfield High', 1),
('Shelbyville High', 2),
('Ogdenville High', 2);


insert into Example (admin_id, type, instruction, question, solution, school_id) values
(1, 'OPEN', 'Solve the equation', 'What is 2 + 2?', '4', 1),
(1, 'OPEN', 'Identify the element', 'What is the chemical symbol for water?', 'H2O', 1),
(2, 'OPEN', 'Calculate the area', 'What is the area of a circle with radius 3?', '28.27', 1),
(2, 'OPEN', 'Name the year', 'In what year did World War II end?', '1945', 1),
(2, 'OPEN', 'Identify the author', 'Who wrote "To Kill a Mockingbird"?', 'Harper Lee', 1);