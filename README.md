This is a fork of [Pingvin Share](https://github.com/stonith404/pingvin-share) by [stonith404](https://github.com/stonith404)

This is for my own use, as such features are removed and changes made to suit me

## Migrating from Pingvin Share

If you are upgrading from a Pingvin Share installation, the database file
`pingvin-share.db` will be automatically renamed to `gnome-share.db` on first
startup (as long as `DATABASE_URL` is not explicitly set).

If the automatic rename did not work for any reason, manually rename the file
before starting the application:

```sh
mv data/pingvin-share.db data/gnome-share.db
# Also rename auxiliary database files if they exist:
mv data/pingvin-share.db-wal data/gnome-share.db-wal 2>/dev/null || true
mv data/pingvin-share.db-shm data/gnome-share.db-shm 2>/dev/null || true
mv data/pingvin-share.db-journal data/gnome-share.db-journal 2>/dev/null || true
```
