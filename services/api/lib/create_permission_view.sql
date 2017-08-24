-- Copyright (C) The Arvados Authors. All rights reserved.
--
-- SPDX-License-Identifier: AGPL-3.0

-- constructing perm_edges
--   1. get the list of all permission links,
--   2. any can_manage link or permission link to a group means permission should "follow through"
--      (as a special case, can_manage links to a user grant access to everything owned by the user,
--       unlike can_read or can_write which only grant access to the user record)
--   3. add all owner->owned relationships between groups as can_manage edges
--
-- constructing permissions
--   1. base case: start with set of all users as the working set
--   2. recursive case:
--      join with edges where the tail is in the working set and "follow" is true
--      produce a new working set with the head (target) of each edge
--      set permission to the least permission encountered on the path
--      propagate trashed flag down

CREATE TEMPORARY VIEW permission_view AS
WITH RECURSIVE
perm_value (name, val) AS (
     VALUES
     ('can_read',   1::smallint),
     ('can_login',  1),
     ('can_write',  2),
     ('can_manage', 3)
     ),
perm_edges (tail_uuid, head_uuid, val, follow, trashed) AS (
       SELECT links.tail_uuid,
              links.head_uuid,
              pv.val,
              (pv.val = 3 OR groups.uuid IS NOT NULL) AS follow,
              0::smallint AS trashed
              FROM links
              LEFT JOIN perm_value pv ON pv.name = links.name
              LEFT JOIN groups ON pv.val<3 AND groups.uuid = links.head_uuid
              WHERE links.link_class = 'permission'
       UNION ALL
       SELECT owner_uuid, uuid, 3, true, 0::smallint FROM groups
       ),
perm (val, follow, user_uuid, target_uuid, trashed, startnode) AS (
     SELECT 3::smallint             AS val,
            false                   AS follow,
            users.uuid::varchar(32) AS user_uuid,
            users.uuid::varchar(32) AS target_uuid,
            0::smallint             AS trashed,
            true                    AS startnode
            FROM users
     UNION
     SELECT LEAST(perm.val, edges.val)::smallint  AS val,
            edges.follow                          AS follow,
            perm.user_uuid::varchar(32)           AS user_uuid,
            edges.head_uuid::varchar(32)          AS target_uuid,
            GREATEST(perm.trashed, edges.trashed)::smallint AS trashed,
            false                                 AS startnode
            FROM perm
            INNER JOIN perm_edges edges
            ON (perm.startnode or perm.follow) AND edges.tail_uuid = perm.target_uuid
)
SELECT user_uuid,
       target_uuid,
       MAX(val) AS perm_level,
       CASE follow WHEN true THEN target_uuid ELSE NULL END AS target_owner_uuid,
       MAX(trashed) AS trashed
       FROM perm
       GROUP BY user_uuid, target_uuid, target_owner_uuid;
