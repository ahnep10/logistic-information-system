--
-- PostgreSQL database dump
--

\restrict Ay0nbRZy7SiCKj6IyLYsgZrkyioIgk4CVlNN1w6bX7JdbZiZmgMY5zBl9DM2W1a

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'MANAGER',
    'STAFF'
);


ALTER TYPE public."Role" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id text NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    "categoryId" text NOT NULL,
    "reorderThreshold" integer DEFAULT 0 NOT NULL,
    "currentStock" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    name text NOT NULL,
    "contactPerson" text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    address text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'STAFF'::public."Role" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
612bf140-f4b5-41f6-914d-1b84573270ed	c6095bc1edb0fe94c5bae06561661ae8c9b86673bd7ad42ad3a869689f93d65f	2026-06-30 04:53:22.295106+00	20260630045322_init	\N	\N	2026-06-30 04:53:22.284649+00	1
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, "isActive", "createdAt", "updatedAt") FROM stdin;
cmr0twm0t0000v1uw3046nogc	Samsong A56	t	2026-06-30 15:56:03.581	2026-06-30 16:53:19.102
cmr0txn2n0001v1uwz848micf	Electronics	f	2026-06-30 15:56:51.6	2026-07-01 00:29:37.69
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, sku, "categoryId", "reorderThreshold", "currentStock", "isActive", "createdAt", "updatedAt") FROM stdin;
cmr0ty51e0003v1uwgspgii80	Samsong A56	PROD-001	cmr0txn2n0001v1uwz848micf	60	0	t	2026-06-30 15:57:14.881	2026-06-30 15:57:14.881
cmr0w68cx0002v13wnud6rcje	Samsong A56	PROD-002	cmr0twm0t0000v1uw3046nogc	100	0	t	2026-06-30 16:59:31.663	2026-06-30 16:59:31.663
cmr0w7ty70004v13wmjup0pmy	Samsong A56	PROD-003	cmr0txn2n0001v1uwz848micf	100	0	t	2026-06-30 17:00:46.303	2026-06-30 17:00:46.303
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, name, "contactPerson", phone, email, address, "isActive", "createdAt", "updatedAt") FROM stdin;
cmr0tyyb90004v1uw3m2nx459	aery	Aryazh Dianta	90123	aeryy@gmail.com	Jl. Kimpulan, RT.01/RW.01, No.18, Krawitan\r\nhttps://maps.app.goo.gl/34zLx8wdJboVHJTW6\r\nKost pak mohadi di google maps	t	2026-06-30 15:57:52.82	2026-07-01 00:35:31.247
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, name, "passwordHash", role, "isActive", "createdAt", "updatedAt") FROM stdin;
cmr069i180000v1a08hqkbqcs	admin@logistics.com	System Administrator	$2b$12$qJ3p4Dd0sCifmrq6N4EKF.CTIRFqVILLCbiRvNilxeXr/fSjnMJli	MANAGER	t	2026-06-30 04:54:14.156	2026-06-30 04:54:14.156
cmr0veeo60000v13wm87ev0ko	karin@logis.com	karin	$2b$12$hPvh7z/bDaEbBsFzlwSe2OYHNSNbiRdeVYyUH3jTuTwZCi4XSLWFy	STAFF	t	2026-06-30 16:37:53.477	2026-06-30 16:37:53.477
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: products products_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict Ay0nbRZy7SiCKj6IyLYsgZrkyioIgk4CVlNN1w6bX7JdbZiZmgMY5zBl9DM2W1a

