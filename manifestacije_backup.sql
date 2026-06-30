--
-- PostgreSQL database dump
--

\restrict FDW8Ji2ifkpBBhKb49aYBNx0vuGQaJIecDKCL7I3lVNQStn2JtxN6NULkHAQZLJ

-- Dumped from database version 18.4 (Debian 18.4-1.pgdg13+1)
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DuplicateStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DuplicateStatus" AS ENUM (
    'OPEN',
    'MERGED',
    'DISMISSED'
);


ALTER TYPE public."DuplicateStatus" OWNER TO postgres;

--
-- Name: EventSourceKind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EventSourceKind" AS ENUM (
    'MANUAL',
    'ORGANIZER_FORM',
    'EMAIL',
    'URL_SUBMISSION',
    'IMPORTED'
);


ALTER TYPE public."EventSourceKind" OWNER TO postgres;

--
-- Name: EventSourceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EventSourceStatus" AS ENUM (
    'NEW',
    'PARSED',
    'NEEDS_REVIEW',
    'LINKED',
    'REJECTED'
);


ALTER TYPE public."EventSourceStatus" OWNER TO postgres;

--
-- Name: EventSourceType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EventSourceType" AS ENUM (
    'EMAIL',
    'URL',
    'MANUAL',
    'SCRAPE_DISCOVERY'
);


ALTER TYPE public."EventSourceType" OWNER TO postgres;

--
-- Name: EventStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."EventStatus" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'PUBLISHED',
    'REJECTED',
    'ARCHIVED'
);


ALTER TYPE public."EventStatus" OWNER TO postgres;

--
-- Name: IngestionJobStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."IngestionJobStatus" AS ENUM (
    'QUEUED',
    'RUNNING',
    'DONE',
    'FAILED'
);


ALTER TYPE public."IngestionJobStatus" OWNER TO postgres;

--
-- Name: IngestionJobType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."IngestionJobType" AS ENUM (
    'EMAIL_PARSE',
    'URL_PARSE',
    'DUPLICATE_CHECK',
    'GEOCODE'
);


ALTER TYPE public."IngestionJobType" OWNER TO postgres;

--
-- Name: OrganizerStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrganizerStatus" AS ENUM (
    'UNCLAIMED',
    'CLAIMED',
    'VERIFIED',
    'TRUSTED'
);


ALTER TYPE public."OrganizerStatus" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'ORGANIZER'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Category" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "parentId" integer,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."Category" OWNER TO postgres;

--
-- Name: Category_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Category_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Category_id_seq" OWNER TO postgres;

--
-- Name: Category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Category_id_seq" OWNED BY public."Category".id;


--
-- Name: City; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."City" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "countyId" integer NOT NULL,
    lat double precision,
    lng double precision
);


ALTER TABLE public."City" OWNER TO postgres;

--
-- Name: City_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."City_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."City_id_seq" OWNER TO postgres;

--
-- Name: City_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."City_id_seq" OWNED BY public."City".id;


--
-- Name: County; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."County" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "regionId" integer NOT NULL
);


ALTER TABLE public."County" OWNER TO postgres;

--
-- Name: County_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."County_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."County_id_seq" OWNER TO postgres;

--
-- Name: County_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."County_id_seq" OWNED BY public."County".id;


--
-- Name: Event; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Event" (
    id integer NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text NOT NULL,
    "shortDescription" text,
    status public."EventStatus" DEFAULT 'PENDING_REVIEW'::public."EventStatus" NOT NULL,
    "organizerId" integer,
    "venueId" integer,
    "cityId" integer NOT NULL,
    "countyId" integer NOT NULL,
    "regionId" integer NOT NULL,
    "categoryId" integer NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone,
    "isAllDay" boolean DEFAULT false NOT NULL,
    "isFree" boolean,
    "priceText" text,
    "ticketUrl" text,
    "sourceUrl" text,
    "imageUrl" text,
    "sourceType" public."EventSourceKind" DEFAULT 'MANUAL'::public."EventSourceKind" NOT NULL,
    "extractionConfidence" double precision,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Event" OWNER TO postgres;

--
-- Name: EventDuplicateCandidate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."EventDuplicateCandidate" (
    id integer NOT NULL,
    "eventAId" integer NOT NULL,
    "eventBId" integer NOT NULL,
    score double precision NOT NULL,
    reason text NOT NULL,
    status public."DuplicateStatus" DEFAULT 'OPEN'::public."DuplicateStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."EventDuplicateCandidate" OWNER TO postgres;

--
-- Name: EventDuplicateCandidate_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."EventDuplicateCandidate_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EventDuplicateCandidate_id_seq" OWNER TO postgres;

--
-- Name: EventDuplicateCandidate_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."EventDuplicateCandidate_id_seq" OWNED BY public."EventDuplicateCandidate".id;


--
-- Name: EventSource; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."EventSource" (
    id integer NOT NULL,
    "eventId" integer,
    "organizerId" integer,
    type public."EventSourceType" NOT NULL,
    "sourceUrl" text,
    "rawText" text,
    "rawHtml" text,
    "rawEmailSubject" text,
    "rawEmailFrom" text,
    "rawEmailDate" timestamp(3) without time zone,
    "parsedJson" jsonb,
    confidence double precision,
    status public."EventSourceStatus" DEFAULT 'NEW'::public."EventSourceStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."EventSource" OWNER TO postgres;

--
-- Name: EventSource_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."EventSource_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."EventSource_id_seq" OWNER TO postgres;

--
-- Name: EventSource_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."EventSource_id_seq" OWNED BY public."EventSource".id;


--
-- Name: Event_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Event_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Event_id_seq" OWNER TO postgres;

--
-- Name: Event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Event_id_seq" OWNED BY public."Event".id;


--
-- Name: IngestionJob; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."IngestionJob" (
    id integer NOT NULL,
    type public."IngestionJobType" NOT NULL,
    status public."IngestionJobStatus" DEFAULT 'QUEUED'::public."IngestionJobStatus" NOT NULL,
    payload jsonb NOT NULL,
    result jsonb,
    error text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."IngestionJob" OWNER TO postgres;

--
-- Name: IngestionJob_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."IngestionJob_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."IngestionJob_id_seq" OWNER TO postgres;

--
-- Name: IngestionJob_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."IngestionJob_id_seq" OWNED BY public."IngestionJob".id;


--
-- Name: Organizer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Organizer" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "websiteUrl" text,
    "facebookUrl" text,
    "instagramUrl" text,
    email text,
    phone text,
    status public."OrganizerStatus" DEFAULT 'UNCLAIMED'::public."OrganizerStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Organizer" OWNER TO postgres;

--
-- Name: Organizer_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Organizer_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Organizer_id_seq" OWNER TO postgres;

--
-- Name: Organizer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Organizer_id_seq" OWNED BY public."Organizer".id;


--
-- Name: Region; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Region" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public."Region" OWNER TO postgres;

--
-- Name: Region_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Region_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Region_id_seq" OWNER TO postgres;

--
-- Name: Region_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Region_id_seq" OWNED BY public."Region".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    role public."UserRole" NOT NULL,
    "organizerId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Venue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Venue" (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    address text,
    "cityId" integer NOT NULL,
    lat double precision,
    lng double precision,
    source text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Venue" OWNER TO postgres;

--
-- Name: Venue_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Venue_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Venue_id_seq" OWNER TO postgres;

--
-- Name: Venue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Venue_id_seq" OWNED BY public."Venue".id;


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
-- Name: Category id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category" ALTER COLUMN id SET DEFAULT nextval('public."Category_id_seq"'::regclass);


--
-- Name: City id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."City" ALTER COLUMN id SET DEFAULT nextval('public."City_id_seq"'::regclass);


--
-- Name: County id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."County" ALTER COLUMN id SET DEFAULT nextval('public."County_id_seq"'::regclass);


--
-- Name: Event id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event" ALTER COLUMN id SET DEFAULT nextval('public."Event_id_seq"'::regclass);


--
-- Name: EventDuplicateCandidate id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventDuplicateCandidate" ALTER COLUMN id SET DEFAULT nextval('public."EventDuplicateCandidate_id_seq"'::regclass);


--
-- Name: EventSource id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventSource" ALTER COLUMN id SET DEFAULT nextval('public."EventSource_id_seq"'::regclass);


--
-- Name: IngestionJob id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IngestionJob" ALTER COLUMN id SET DEFAULT nextval('public."IngestionJob_id_seq"'::regclass);


--
-- Name: Organizer id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Organizer" ALTER COLUMN id SET DEFAULT nextval('public."Organizer_id_seq"'::regclass);


--
-- Name: Region id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Region" ALTER COLUMN id SET DEFAULT nextval('public."Region_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: Venue id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Venue" ALTER COLUMN id SET DEFAULT nextval('public."Venue_id_seq"'::regclass);


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Category" (id, name, slug, "parentId", "sortOrder") FROM stdin;
1	Glazba	glazba	\N	0
2	Kultura	kultura	\N	1
3	Djeca i obitelj	djeca-i-obitelj	\N	2
4	Sport	sport	\N	3
5	Outdoor	outdoor	\N	4
6	Hrana i vino	hrana-i-vino	\N	5
7	Radionice	radionice	\N	6
8	Sajmovi	sajmovi	\N	7
9	Humanitarno	humanitarno	\N	8
10	Noćni život	nocni-zivot	\N	9
11	Edukacija	edukacija	\N	10
12	Udruge	udruge	\N	11
13	Tradicija i folklor	tradicija-i-folklor	\N	12
14	Ostalo	ostalo	\N	13
\.


--
-- Data for Name: City; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."City" (id, name, slug, "countyId", lat, lng) FROM stdin;
1	Osijek	osijek	1	45.555	18.695
2	Zagreb	zagreb	6	45.815	15.982
3	Đakovo	dakovo	1	45.309	18.41
4	Vukovar	vukovar	2	45.351	19.003
5	Vinkovci	vinkovci	2	45.288	18.804
6	Našice	nasice	1	45.488	18.087
7	Valpovo	valpovo	1	45.66	18.418
8	Beli Manastir	beli-manastir	1	45.771	18.603
9	Donji Miholjac	donji-miholjac	1	45.761	18.167
10	Erdut	erdut	1	45.526	19.061
11	Čepin	cepin	1	45.523	18.563
12	Belišće	belisce	1	45.681	18.405
13	Darda	darda	1	45.628	18.699
14	Bilje	bilje	1	45.607	18.744
15	Bizovac	bizovac	1	45.592	18.458
16	Kneževi Vinogradi	knezevi-vinogradi	1	45.75	18.733
17	Batina	batina	1	45.85	18.85
18	Aljmaš	aljmas	1	45.53	18.95
19	Petrijevci	petrijevci	1	45.612	18.535
20	Sarvaš	sarvas	1	45.534	18.837
21	Tenja	tenja	1	45.498	18.747
22	Antunovac	antunovac	1	45.49	18.676
23	Višnjevac	visnjevac	1	45.568	18.613
24	Karanac	karanac	1	45.76	18.684
25	Zmajevac	zmajevac	1	45.801	18.804
26	Ilok	ilok	2	45.222	19.376
27	Županja	zupanja	2	45.077	18.697
28	Otok	otok	2	45.146	18.883
29	Tovarnik	tovarnik	2	45.165	19.153
30	Nuštar	nustar	2	45.332	18.842
31	Borovo	borovo	2	45.376	18.966
32	Slavonski Brod	slavonski-brod	3	45.16	18.015
33	Nova Gradiška	nova-gradiska	3	45.256	17.383
34	Slavonski Šamac	slavonski-samac	3	45.066	18.488
35	Požega	pozega	4	45.331	17.674
36	Pakrac	pakrac	4	45.436	17.188
37	Lipik	lipik	4	45.412	17.152
38	Pleternica	pleternica	4	45.288	17.806
39	Kutjevo	kutjevo	4	45.426	17.883
40	Virovitica	virovitica	5	45.832	17.383
41	Slatina	slatina	5	45.704	17.703
42	Orahovica	orahovica	5	45.541	17.884
43	Pitomača	pitomaca	5	45.95	17.233
\.


--
-- Data for Name: County; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."County" (id, name, slug, "regionId") FROM stdin;
1	Osječko-baranjska	osjecko-baranjska	1
2	Vukovarsko-srijemska	vukovarsko-srijemska	1
3	Brodsko-posavska	brodsko-posavska	1
4	Požeško-slavonska	pozesko-slavonska	1
5	Virovitičko-podravska	viroviticko-podravska	1
6	Grad Zagreb	grad-zagreb	2
\.


--
-- Data for Name: Event; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Event" (id, title, slug, description, "shortDescription", status, "organizerId", "venueId", "cityId", "countyId", "regionId", "categoryId", "startsAt", "endsAt", "isAllDay", "isFree", "priceText", "ticketUrl", "sourceUrl", "imageUrl", "sourceType", "extractionConfidence", "publishedAt", "createdAt", "updatedAt") FROM stdin;
1	Glazba u Osijek 1	glazba-u-osijek-1	Primjer manifestacije u Osijek. Program je seed podatak za razvoj MVP-a.	Seed događaj u Osijek.	PUBLISHED	1	1	1	1	1	1	2026-06-30 18:00:00	2026-06-30 20:00:00	f	f	5 EUR	\N	https://example.com/event-1	\N	IMPORTED	0.9	2026-06-30 13:47:45.214	2026-06-30 13:47:45.215	2026-06-30 13:47:45.215
2	Kultura u Zagreb 2	kultura-u-zagreb-2	Primjer manifestacije u Zagreb. Program je seed podatak za razvoj MVP-a.	Seed događaj u Zagreb.	PUBLISHED	2	2	2	6	2	2	2026-07-01 18:00:00	2026-07-01 20:00:00	f	t	\N	\N	https://example.com/event-2	\N	IMPORTED	0.9	2026-06-30 13:47:47.078	2026-06-30 13:47:47.08	2026-06-30 13:47:47.08
3	Djeca i obitelj u Đakovo 3	djeca-i-obitelj-u-dakovo-3	Primjer manifestacije u Đakovo. Program je seed podatak za razvoj MVP-a.	Seed događaj u Đakovo.	PUBLISHED	3	3	3	1	1	3	2026-07-02 18:00:00	2026-07-02 20:00:00	f	t	\N	\N	https://example.com/event-3	\N	IMPORTED	0.9	2026-06-30 13:47:48.512	2026-06-30 13:47:48.513	2026-06-30 13:47:48.513
4	Sport u Vukovar 4	sport-u-vukovar-4	Primjer manifestacije u Vukovar. Program je seed podatak za razvoj MVP-a.	Seed događaj u Vukovar.	PUBLISHED	4	4	4	2	1	4	2026-07-03 18:00:00	2026-07-03 20:00:00	f	f	5 EUR	\N	https://example.com/event-4	\N	IMPORTED	0.9	2026-06-30 13:47:49.943	2026-06-30 13:47:49.944	2026-06-30 13:47:49.944
5	Outdoor u Vinkovci 5	outdoor-u-vinkovci-5	Primjer manifestacije u Vinkovci. Program je seed podatak za razvoj MVP-a.	Seed događaj u Vinkovci.	PUBLISHED	5	5	5	2	1	5	2026-07-04 18:00:00	2026-07-04 20:00:00	f	t	\N	\N	https://example.com/event-5	\N	IMPORTED	0.9	2026-06-30 13:47:51.379	2026-06-30 13:47:51.38	2026-06-30 13:47:51.38
6	Hrana i vino u Našice 6	hrana-i-vino-u-nasice-6	Primjer manifestacije u Našice. Program je seed podatak za razvoj MVP-a.	Seed događaj u Našice.	PUBLISHED	6	6	6	1	1	6	2026-07-05 18:00:00	2026-07-05 20:00:00	f	t	\N	\N	https://example.com/event-6	\N	IMPORTED	0.9	2026-06-30 13:47:52.809	2026-06-30 13:47:52.811	2026-06-30 13:47:52.811
7	Radionice u Valpovo 7	radionice-u-valpovo-7	Primjer manifestacije u Valpovo. Program je seed podatak za razvoj MVP-a.	Seed događaj u Valpovo.	PUBLISHED	7	7	7	1	1	7	2026-07-06 18:00:00	2026-07-06 20:00:00	f	f	5 EUR	\N	https://example.com/event-7	\N	IMPORTED	0.9	2026-06-30 13:47:54.243	2026-06-30 13:47:54.244	2026-06-30 13:47:54.244
8	Sajmovi u Beli Manastir 8	sajmovi-u-beli-manastir-8	Primjer manifestacije u Beli Manastir. Program je seed podatak za razvoj MVP-a.	Seed događaj u Beli Manastir.	PUBLISHED	8	8	8	1	1	8	2026-07-07 18:00:00	2026-07-07 20:00:00	f	t	\N	\N	https://example.com/event-8	\N	IMPORTED	0.9	2026-06-30 13:47:55.677	2026-06-30 13:47:55.678	2026-06-30 13:47:55.678
9	Humanitarno u Donji Miholjac 9	humanitarno-u-donji-miholjac-9	Primjer manifestacije u Donji Miholjac. Program je seed podatak za razvoj MVP-a.	Seed događaj u Donji Miholjac.	PUBLISHED	9	9	9	1	1	9	2026-07-08 18:00:00	2026-07-08 20:00:00	f	t	\N	\N	https://example.com/event-9	\N	IMPORTED	0.9	2026-06-30 13:47:57.11	2026-06-30 13:47:57.111	2026-06-30 13:47:57.111
10	Noćni život u Erdut 10	nocni-zivot-u-erdut-10	Primjer manifestacije u Erdut. Program je seed podatak za razvoj MVP-a.	Seed događaj u Erdut.	PUBLISHED	10	10	10	1	1	10	2026-07-09 18:00:00	2026-07-09 20:00:00	f	f	5 EUR	\N	https://example.com/event-10	\N	IMPORTED	0.9	2026-06-30 13:47:58.546	2026-06-30 13:47:58.547	2026-06-30 13:47:58.547
11	Edukacija u Čepin 11	edukacija-u-cepin-11	Primjer manifestacije u Čepin. Program je seed podatak za razvoj MVP-a.	Seed događaj u Čepin.	PUBLISHED	1	11	11	1	1	11	2026-07-10 18:00:00	2026-07-10 20:00:00	f	t	\N	\N	https://example.com/event-11	\N	IMPORTED	0.9	2026-06-30 13:48:00.119	2026-06-30 13:48:00.12	2026-06-30 13:48:00.12
12	Udruge u Belišće 12	udruge-u-belisce-12	Primjer manifestacije u Belišće. Program je seed podatak za razvoj MVP-a.	Seed događaj u Belišće.	PUBLISHED	2	12	12	1	1	12	2026-07-11 18:00:00	2026-07-11 20:00:00	f	t	\N	\N	https://example.com/event-12	\N	IMPORTED	0.9	2026-06-30 13:48:01.555	2026-06-30 13:48:01.556	2026-06-30 13:48:01.556
13	Tradicija i folklor u Darda 13	tradicija-i-folklor-u-darda-13	Primjer manifestacije u Darda. Program je seed podatak za razvoj MVP-a.	Seed događaj u Darda.	PUBLISHED	3	13	13	1	1	13	2026-07-12 18:00:00	2026-07-12 20:00:00	f	f	5 EUR	\N	https://example.com/event-13	\N	IMPORTED	0.9	2026-06-30 13:48:02.988	2026-06-30 13:48:02.989	2026-06-30 13:48:02.989
14	Ostalo u Bilje 14	ostalo-u-bilje-14	Primjer manifestacije u Bilje. Program je seed podatak za razvoj MVP-a.	Seed događaj u Bilje.	PUBLISHED	4	14	14	1	1	14	2026-07-13 18:00:00	2026-07-13 20:00:00	f	t	\N	\N	https://example.com/event-14	\N	IMPORTED	0.9	2026-06-30 13:48:04.42	2026-06-30 13:48:04.421	2026-06-30 13:48:04.421
15	Glazba u Bizovac 15	glazba-u-bizovac-15	Primjer manifestacije u Bizovac. Program je seed podatak za razvoj MVP-a.	Seed događaj u Bizovac.	PUBLISHED	5	15	15	1	1	1	2026-07-14 18:00:00	2026-07-14 20:00:00	f	t	\N	\N	https://example.com/event-15	\N	IMPORTED	0.9	2026-06-30 13:48:05.858	2026-06-30 13:48:05.859	2026-06-30 13:48:05.859
16	Kultura u Kneževi Vinogradi 16	kultura-u-knezevi-vinogradi-16	Primjer manifestacije u Kneževi Vinogradi. Program je seed podatak za razvoj MVP-a.	Seed događaj u Kneževi Vinogradi.	PUBLISHED	6	16	16	1	1	2	2026-07-15 18:00:00	2026-07-15 20:00:00	f	f	5 EUR	\N	https://example.com/event-16	\N	IMPORTED	0.9	2026-06-30 13:48:07.295	2026-06-30 13:48:07.296	2026-06-30 13:48:07.296
17	Djeca i obitelj u Batina 17	djeca-i-obitelj-u-batina-17	Primjer manifestacije u Batina. Program je seed podatak za razvoj MVP-a.	Seed događaj u Batina.	PUBLISHED	7	17	17	1	1	3	2026-07-16 18:00:00	2026-07-16 20:00:00	f	t	\N	\N	https://example.com/event-17	\N	IMPORTED	0.9	2026-06-30 13:48:08.726	2026-06-30 13:48:08.727	2026-06-30 13:48:08.727
18	Sport u Aljmaš 18	sport-u-aljmas-18	Primjer manifestacije u Aljmaš. Program je seed podatak za razvoj MVP-a.	Seed događaj u Aljmaš.	PUBLISHED	8	18	18	1	1	4	2026-07-17 18:00:00	2026-07-17 20:00:00	f	t	\N	\N	https://example.com/event-18	\N	IMPORTED	0.9	2026-06-30 13:48:10.156	2026-06-30 13:48:10.157	2026-06-30 13:48:10.157
19	Outdoor u Petrijevci 19	outdoor-u-petrijevci-19	Primjer manifestacije u Petrijevci. Program je seed podatak za razvoj MVP-a.	Seed događaj u Petrijevci.	PUBLISHED	9	19	19	1	1	5	2026-07-18 18:00:00	2026-07-18 20:00:00	f	f	5 EUR	\N	https://example.com/event-19	\N	IMPORTED	0.9	2026-06-30 13:48:11.587	2026-06-30 13:48:11.588	2026-06-30 13:48:11.588
20	Hrana i vino u Sarvaš 20	hrana-i-vino-u-sarvas-20	Primjer manifestacije u Sarvaš. Program je seed podatak za razvoj MVP-a.	Seed događaj u Sarvaš.	PUBLISHED	10	20	20	1	1	6	2026-07-19 18:00:00	2026-07-19 20:00:00	f	t	\N	\N	https://example.com/event-20	\N	IMPORTED	0.9	2026-06-30 13:48:13.022	2026-06-30 13:48:13.023	2026-06-30 13:48:13.023
21	Radionice u Tenja 21	radionice-u-tenja-21	Primjer manifestacije u Tenja. Program je seed podatak za razvoj MVP-a.	Seed događaj u Tenja.	PUBLISHED	1	21	21	1	1	7	2026-07-20 18:00:00	2026-07-20 20:00:00	f	t	\N	\N	https://example.com/event-21	\N	IMPORTED	0.9	2026-06-30 13:48:14.596	2026-06-30 13:48:14.597	2026-06-30 13:48:14.597
22	Sajmovi u Antunovac 22	sajmovi-u-antunovac-22	Primjer manifestacije u Antunovac. Program je seed podatak za razvoj MVP-a.	Seed događaj u Antunovac.	PUBLISHED	2	22	22	1	1	8	2026-07-21 18:00:00	2026-07-21 20:00:00	f	f	5 EUR	\N	https://example.com/event-22	\N	IMPORTED	0.9	2026-06-30 13:48:16.036	2026-06-30 13:48:16.037	2026-06-30 13:48:16.037
23	Humanitarno u Višnjevac 23	humanitarno-u-visnjevac-23	Primjer manifestacije u Višnjevac. Program je seed podatak za razvoj MVP-a.	Seed događaj u Višnjevac.	PUBLISHED	3	23	23	1	1	9	2026-07-22 18:00:00	2026-07-22 20:00:00	f	t	\N	\N	https://example.com/event-23	\N	IMPORTED	0.9	2026-06-30 13:48:17.469	2026-06-30 13:48:17.471	2026-06-30 13:48:17.471
24	Noćni život u Karanac 24	nocni-zivot-u-karanac-24	Primjer manifestacije u Karanac. Program je seed podatak za razvoj MVP-a.	Seed događaj u Karanac.	PUBLISHED	4	24	24	1	1	10	2026-07-23 18:00:00	2026-07-23 20:00:00	f	t	\N	\N	https://example.com/event-24	\N	IMPORTED	0.9	2026-06-30 13:48:18.918	2026-06-30 13:48:18.919	2026-06-30 13:48:18.919
25	Edukacija u Zmajevac 25	edukacija-u-zmajevac-25	Primjer manifestacije u Zmajevac. Program je seed podatak za razvoj MVP-a.	Seed događaj u Zmajevac.	PENDING_REVIEW	5	25	25	1	1	11	2026-07-24 18:00:00	2026-07-24 20:00:00	f	f	5 EUR	\N	https://example.com/event-25	\N	IMPORTED	0.9	\N	2026-06-30 13:48:20.351	2026-06-30 13:48:20.351
26	Udruge u Ilok 26	udruge-u-ilok-26	Primjer manifestacije u Ilok. Program je seed podatak za razvoj MVP-a.	Seed događaj u Ilok.	PENDING_REVIEW	6	26	26	2	1	12	2026-07-25 18:00:00	2026-07-25 20:00:00	f	t	\N	\N	https://example.com/event-26	\N	IMPORTED	0.9	\N	2026-06-30 13:48:21.784	2026-06-30 13:48:21.784
27	Tradicija i folklor u Županja 27	tradicija-i-folklor-u-zupanja-27	Primjer manifestacije u Županja. Program je seed podatak za razvoj MVP-a.	Seed događaj u Županja.	PENDING_REVIEW	7	27	27	2	1	13	2026-07-26 18:00:00	2026-07-26 20:00:00	f	t	\N	\N	https://example.com/event-27	\N	IMPORTED	0.9	\N	2026-06-30 13:48:23.216	2026-06-30 13:48:23.216
28	Ostalo u Otok 28	ostalo-u-otok-28	Primjer manifestacije u Otok. Program je seed podatak za razvoj MVP-a.	Seed događaj u Otok.	PENDING_REVIEW	8	28	28	2	1	14	2026-07-27 18:00:00	2026-07-27 20:00:00	f	f	5 EUR	\N	https://example.com/event-28	\N	IMPORTED	0.9	\N	2026-06-30 13:48:24.646	2026-06-30 13:48:24.646
29	Glazba u Tovarnik 29	glazba-u-tovarnik-29	Primjer manifestacije u Tovarnik. Program je seed podatak za razvoj MVP-a.	Seed događaj u Tovarnik.	PENDING_REVIEW	9	29	29	2	1	1	2026-07-28 18:00:00	2026-07-28 20:00:00	f	t	\N	\N	https://example.com/event-29	\N	IMPORTED	0.9	\N	2026-06-30 13:48:26.091	2026-06-30 13:48:26.091
30	Kultura u Nuštar 30	kultura-u-nustar-30	Primjer manifestacije u Nuštar. Program je seed podatak za razvoj MVP-a.	Seed događaj u Nuštar.	PENDING_REVIEW	10	30	30	2	1	2	2026-07-29 18:00:00	2026-07-29 20:00:00	f	t	\N	\N	https://example.com/event-30	\N	IMPORTED	0.9	\N	2026-06-30 13:48:27.522	2026-06-30 13:48:27.522
\.


--
-- Data for Name: EventDuplicateCandidate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."EventDuplicateCandidate" (id, "eventAId", "eventBId", score, reason, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: EventSource; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."EventSource" (id, "eventId", "organizerId", type, "sourceUrl", "rawText", "rawHtml", "rawEmailSubject", "rawEmailFrom", "rawEmailDate", "parsedJson", confidence, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: IngestionJob; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."IngestionJob" (id, type, status, payload, result, error, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Organizer; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Organizer" (id, name, slug, description, "websiteUrl", "facebookUrl", "instagramUrl", email, phone, status, "createdAt", "updatedAt") FROM stdin;
1	TZ Osijek	tz-osijek	\N	\N	\N	\N	tz-osijek@example.com	\N	VERIFIED	2026-06-30 13:47:40.907	2026-06-30 13:47:40.907
2	Kulturni centar Osijek	kulturni-centar-osijek	\N	\N	\N	\N	kulturni-centar-osijek@example.com	\N	VERIFIED	2026-06-30 13:47:41.194	2026-06-30 13:47:41.194
3	Udruga Slama	udruga-slama	\N	\N	\N	\N	udruga-slama@example.com	\N	VERIFIED	2026-06-30 13:47:41.34	2026-06-30 13:47:41.34
4	Sportski savez Osijek	sportski-savez-osijek	\N	\N	\N	\N	sportski-savez-osijek@example.com	\N	VERIFIED	2026-06-30 13:47:41.484	2026-06-30 13:47:41.484
5	Baranjski vinari	baranjski-vinari	\N	\N	\N	\N	baranjski-vinari@example.com	\N	VERIFIED	2026-06-30 13:47:41.629	2026-06-30 13:47:41.629
6	Grad Đakovo	grad-dakovo	\N	\N	\N	\N	grad-dakovo@example.com	\N	VERIFIED	2026-06-30 13:47:41.774	2026-06-30 13:47:41.774
7	Vukovar events	vukovar-events	\N	\N	\N	\N	vukovar-events@example.com	\N	VERIFIED	2026-06-30 13:47:41.919	2026-06-30 13:47:41.919
8	Vinkovačke jeseni	vinkovacke-jeseni	\N	\N	\N	\N	vinkovacke-jeseni@example.com	\N	VERIFIED	2026-06-30 13:47:42.065	2026-06-30 13:47:42.065
9	Našička scena	nasicka-scena	\N	\N	\N	\N	nasicka-scena@example.com	\N	VERIFIED	2026-06-30 13:47:42.209	2026-06-30 13:47:42.209
10	Valpovačko ljeto	valpovacko-ljeto	\N	\N	\N	\N	valpovacko-ljeto@example.com	\N	VERIFIED	2026-06-30 13:47:42.354	2026-06-30 13:47:42.354
\.


--
-- Data for Name: Region; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Region" (id, name, slug, "sortOrder") FROM stdin;
1	Slavonija i Baranja	slavonija-i-baranja	0
2	Zagreb i okolica	zagreb-i-okolica	1
3	Dalmacija	dalmacija	2
4	Istra i Kvarner	istra-i-kvarner	3
5	Središnja Hrvatska	sredisnja-hrvatska	4
6	Lika i Gorski kotar	lika-i-gorski-kotar	5
7	Međimurje i Zagorje	medimurje-i-zagorje	6
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, "passwordHash", name, role, "organizerId", "createdAt", "updatedAt") FROM stdin;
1	admin@manifestacije.hr	$2a$10$qDUrPird/pOVLiTHoIJEJeZd8yXy9t4reFgbT3NlnxGAyd/I18.ti	Admin	ADMIN	\N	2026-06-30 13:47:40.617	2026-06-30 13:47:40.617
\.


--
-- Data for Name: Venue; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Venue" (id, name, slug, address, "cityId", lat, lng, source, "createdAt", "updatedAt") FROM stdin;
1	Osijek centar	osijek-centar	Trg 1	1	\N	\N	\N	2026-06-30 13:47:44.071	2026-06-30 13:47:44.071
2	Zagreb centar	zagreb-centar	Trg 1	2	\N	\N	\N	2026-06-30 13:47:46.361	2026-06-30 13:47:46.361
3	Đakovo centar	dakovo-centar	Trg 1	3	\N	\N	\N	2026-06-30 13:47:47.796	2026-06-30 13:47:47.796
4	Vukovar centar	vukovar-centar	Trg 1	4	\N	\N	\N	2026-06-30 13:47:49.229	2026-06-30 13:47:49.229
5	Vinkovci centar	vinkovci-centar	Trg 1	5	\N	\N	\N	2026-06-30 13:47:50.665	2026-06-30 13:47:50.665
6	Našice centar	nasice-centar	Trg 1	6	\N	\N	\N	2026-06-30 13:47:52.095	2026-06-30 13:47:52.095
7	Valpovo centar	valpovo-centar	Trg 1	7	\N	\N	\N	2026-06-30 13:47:53.528	2026-06-30 13:47:53.528
8	Beli Manastir centar	beli-manastir-centar	Trg 1	8	\N	\N	\N	2026-06-30 13:47:54.96	2026-06-30 13:47:54.96
9	Donji Miholjac centar	donji-miholjac-centar	Trg 1	9	\N	\N	\N	2026-06-30 13:47:56.395	2026-06-30 13:47:56.395
10	Erdut centar	erdut-centar	Trg 1	10	\N	\N	\N	2026-06-30 13:47:57.829	2026-06-30 13:47:57.829
11	Čepin centar	cepin-centar	Trg 1	11	\N	\N	\N	2026-06-30 13:47:59.405	2026-06-30 13:47:59.405
12	Belišće centar	belisce-centar	Trg 1	12	\N	\N	\N	2026-06-30 13:48:00.84	2026-06-30 13:48:00.84
13	Darda centar	darda-centar	Trg 1	13	\N	\N	\N	2026-06-30 13:48:02.272	2026-06-30 13:48:02.272
14	Bilje centar	bilje-centar	Trg 1	14	\N	\N	\N	2026-06-30 13:48:03.706	2026-06-30 13:48:03.706
15	Bizovac centar	bizovac-centar	Trg 1	15	\N	\N	\N	2026-06-30 13:48:05.143	2026-06-30 13:48:05.143
16	Kneževi Vinogradi centar	knezevi-vinogradi-centar	Trg 1	16	\N	\N	\N	2026-06-30 13:48:06.575	2026-06-30 13:48:06.575
17	Batina centar	batina-centar	Trg 1	17	\N	\N	\N	2026-06-30 13:48:08.011	2026-06-30 13:48:08.011
18	Aljmaš centar	aljmas-centar	Trg 1	18	\N	\N	\N	2026-06-30 13:48:09.441	2026-06-30 13:48:09.441
19	Petrijevci centar	petrijevci-centar	Trg 1	19	\N	\N	\N	2026-06-30 13:48:10.872	2026-06-30 13:48:10.872
20	Sarvaš centar	sarvas-centar	Trg 1	20	\N	\N	\N	2026-06-30 13:48:12.305	2026-06-30 13:48:12.305
21	Tenja centar	tenja-centar	Trg 1	21	\N	\N	\N	2026-06-30 13:48:13.74	2026-06-30 13:48:13.74
22	Antunovac centar	antunovac-centar	Trg 1	22	\N	\N	\N	2026-06-30 13:48:15.32	2026-06-30 13:48:15.32
23	Višnjevac centar	visnjevac-centar	Trg 1	23	\N	\N	\N	2026-06-30 13:48:16.753	2026-06-30 13:48:16.753
24	Karanac centar	karanac-centar	Trg 1	24	\N	\N	\N	2026-06-30 13:48:18.2	2026-06-30 13:48:18.2
25	Zmajevac centar	zmajevac-centar	Trg 1	25	\N	\N	\N	2026-06-30 13:48:19.634	2026-06-30 13:48:19.634
26	Ilok centar	ilok-centar	Trg 1	26	\N	\N	\N	2026-06-30 13:48:21.068	2026-06-30 13:48:21.068
27	Županja centar	zupanja-centar	Trg 1	27	\N	\N	\N	2026-06-30 13:48:22.499	2026-06-30 13:48:22.499
28	Otok centar	otok-centar	Trg 1	28	\N	\N	\N	2026-06-30 13:48:23.931	2026-06-30 13:48:23.931
29	Tovarnik centar	tovarnik-centar	Trg 1	29	\N	\N	\N	2026-06-30 13:48:25.367	2026-06-30 13:48:25.367
30	Nuštar centar	nustar-centar	Trg 1	30	\N	\N	\N	2026-06-30 13:48:26.806	2026-06-30 13:48:26.806
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
ad7dc4ce-3a98-430c-97e0-7cd58c26977f	7619a404b5e333ffcfba26b6881f668bc05ee34d2bec506d2f93d6b2592b68c7	2026-06-30 13:47:25.357536+00	20260630000000_init	\N	\N	2026-06-30 13:47:24.614301+00	1
\.


--
-- Name: Category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Category_id_seq"', 14, true);


--
-- Name: City_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."City_id_seq"', 43, true);


--
-- Name: County_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."County_id_seq"', 6, true);


--
-- Name: EventDuplicateCandidate_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."EventDuplicateCandidate_id_seq"', 1, false);


--
-- Name: EventSource_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."EventSource_id_seq"', 1, false);


--
-- Name: Event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Event_id_seq"', 30, true);


--
-- Name: IngestionJob_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."IngestionJob_id_seq"', 1, false);


--
-- Name: Organizer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Organizer_id_seq"', 10, true);


--
-- Name: Region_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Region_id_seq"', 7, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 1, true);


--
-- Name: Venue_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Venue_id_seq"', 30, true);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: City City_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."City"
    ADD CONSTRAINT "City_pkey" PRIMARY KEY (id);


--
-- Name: County County_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."County"
    ADD CONSTRAINT "County_pkey" PRIMARY KEY (id);


--
-- Name: EventDuplicateCandidate EventDuplicateCandidate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventDuplicateCandidate"
    ADD CONSTRAINT "EventDuplicateCandidate_pkey" PRIMARY KEY (id);


--
-- Name: EventSource EventSource_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventSource"
    ADD CONSTRAINT "EventSource_pkey" PRIMARY KEY (id);


--
-- Name: Event Event_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY (id);


--
-- Name: IngestionJob IngestionJob_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."IngestionJob"
    ADD CONSTRAINT "IngestionJob_pkey" PRIMARY KEY (id);


--
-- Name: Organizer Organizer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Organizer"
    ADD CONSTRAINT "Organizer_pkey" PRIMARY KEY (id);


--
-- Name: Region Region_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Region"
    ADD CONSTRAINT "Region_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Venue Venue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Venue"
    ADD CONSTRAINT "Venue_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: City_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "City_slug_key" ON public."City" USING btree (slug);


--
-- Name: County_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "County_slug_key" ON public."County" USING btree (slug);


--
-- Name: EventDuplicateCandidate_eventAId_eventBId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "EventDuplicateCandidate_eventAId_eventBId_key" ON public."EventDuplicateCandidate" USING btree ("eventAId", "eventBId");


--
-- Name: Event_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Event_slug_key" ON public."Event" USING btree (slug);


--
-- Name: Organizer_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Organizer_slug_key" ON public."Organizer" USING btree (slug);


--
-- Name: Region_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Region_slug_key" ON public."Region" USING btree (slug);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: Venue_slug_cityId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Venue_slug_cityId_key" ON public."Venue" USING btree (slug, "cityId");


--
-- Name: Category Category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: City City_countyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."City"
    ADD CONSTRAINT "City_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES public."County"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: County County_regionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."County"
    ADD CONSTRAINT "County_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES public."Region"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventDuplicateCandidate EventDuplicateCandidate_eventAId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventDuplicateCandidate"
    ADD CONSTRAINT "EventDuplicateCandidate_eventAId_fkey" FOREIGN KEY ("eventAId") REFERENCES public."Event"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventDuplicateCandidate EventDuplicateCandidate_eventBId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventDuplicateCandidate"
    ADD CONSTRAINT "EventDuplicateCandidate_eventBId_fkey" FOREIGN KEY ("eventBId") REFERENCES public."Event"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EventSource EventSource_eventId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventSource"
    ADD CONSTRAINT "EventSource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES public."Event"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EventSource EventSource_organizerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."EventSource"
    ADD CONSTRAINT "EventSource_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES public."Organizer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Event Event_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_cityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES public."City"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_countyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES public."County"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_organizerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES public."Organizer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Event Event_regionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES public."Region"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_venueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES public."Venue"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_organizerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES public."Organizer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Venue Venue_cityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Venue"
    ADD CONSTRAINT "Venue_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES public."City"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict FDW8Ji2ifkpBBhKb49aYBNx0vuGQaJIecDKCL7I3lVNQStn2JtxN6NULkHAQZLJ

