use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Comment::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Comment::TrackId)
                            .text()
                            .not_null()
                            .primary_key(),
                    )
                    .col(text(Comment::Comment))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table("comment").to_owned())
            .await
    }
}


#[derive(DeriveIden)]
enum Comment {
    Table,  // don't forget this
    TrackId,
    Comment,
}
