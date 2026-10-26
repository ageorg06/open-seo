CREATE TABLE "project_brand_aliases" (
	"project_id" text NOT NULL,
	"domain" text NOT NULL,
	"alias" text NOT NULL,
	CONSTRAINT "project_brand_aliases_project_id_domain_alias_pk" PRIMARY KEY("project_id","domain","alias")
);
--> statement-breakpoint
ALTER TABLE "project_brand_aliases" ADD CONSTRAINT "project_brand_aliases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;