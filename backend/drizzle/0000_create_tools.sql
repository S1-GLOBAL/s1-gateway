CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"url" varchar(2048) NOT NULL,
	"description" varchar(280) DEFAULT '' NOT NULL,
	"category" varchar(40) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tools_name_lower_unique" ON "tools" USING btree (lower("name"));