--
-- PostgreSQL database dump
--


-- Dumped from database version 15.12
-- Dumped by pg_dump version 15.16

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
-- Name: prj_uPH5TTGC6BEc; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_uPH5TTGC6BEc";


--
-- Name: prj_uPH5TTGC6BEc_auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_uPH5TTGC6BEc_auth";


--
-- Name: prj_uPH5TTGC6BEc_storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA "prj_uPH5TTGC6BEc_storage";


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE FUNCTION "prj_uPH5TTGC6BEc".handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
INSERT INTO "prj_uPH5TTGC6BEc".profiles (id, email, full_name, role)
VALUES (
NEW.id,
NEW.email,
COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
COALESCE(NEW.raw_user_meta_data->>'role', 'student')
);
RETURN NEW;
END;
$$;


--
-- Name: auth_uid(); Type: FUNCTION; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE FUNCTION "prj_uPH5TTGC6BEc_auth".auth_uid() RETURNS uuid
    LANGUAGE sql
    AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;


--
-- Name: role(); Type: FUNCTION; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE FUNCTION "prj_uPH5TTGC6BEc_auth".role() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT COALESCE(current_setting('request.jwt.claim.role', true), 'anon')
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

CREATE FUNCTION "prj_uPH5TTGC6BEc_storage".foldername(name text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT string_to_array(name, '/')
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action character varying(200) NOT NULL,
    entity_type character varying(100),
    entity_id uuid,
    performed_by character varying(200),
    details jsonb,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: courses; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(20) NOT NULL,
    title character varying(300) NOT NULL,
    credit_unit integer NOT NULL,
    department_id uuid,
    level integer NOT NULL,
    semester integer NOT NULL,
    year integer NOT NULL,
    lecturer_id uuid,
    description text,
    is_elective boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT courses_credit_unit_check CHECK (((credit_unit > 0) AND (credit_unit <= 6))),
    CONSTRAINT courses_semester_check CHECK ((semester = ANY (ARRAY[1, 2])))
);


--
-- Name: departments; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(200) NOT NULL,
    code character varying(20) NOT NULL,
    faculty character varying(200) NOT NULL,
    head_name character varying(200),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: documents; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    file_name character varying(300) NOT NULL,
    file_url text NOT NULL,
    file_type character varying(50),
    document_type character varying(100) NOT NULL,
    verified boolean DEFAULT false,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: enrollments; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    course_id uuid,
    academic_year integer NOT NULL,
    semester integer NOT NULL,
    status character varying(20) DEFAULT 'enrolled'::character varying,
    enrolled_at timestamp with time zone DEFAULT now()
);


--
-- Name: lecturers; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".lecturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    title character varying(20) DEFAULT 'Dr.'::character varying,
    email character varying(200),
    phone character varying(20),
    department_id uuid,
    specialization character varying(200),
    photo_url text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".profiles (
    id uuid NOT NULL,
    email character varying(200) NOT NULL,
    full_name character varying(200) NOT NULL,
    role character varying(20) NOT NULL,
    student_id uuid,
    lecturer_id uuid,
    avatar_url text,
    matric_no character varying(50),
    staff_id character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'student'::character varying, 'lecturer'::character varying])::text[])))
);


--
-- Name: results; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    course_id uuid,
    enrollment_id uuid,
    ca_score numeric(5,2) DEFAULT 0,
    exam_score numeric(5,2) DEFAULT 0,
    total_score numeric(5,2) GENERATED ALWAYS AS ((ca_score + exam_score)) STORED,
    grade character varying(5),
    grade_point numeric(3,1),
    status character varying(20) DEFAULT 'pending'::character varying,
    submitted_by uuid,
    approved_by character varying(200),
    submitted_at timestamp with time zone,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT results_ca_score_check CHECK (((ca_score >= (0)::numeric) AND (ca_score <= (40)::numeric))),
    CONSTRAINT results_exam_score_check CHECK (((exam_score >= (0)::numeric) AND (exam_score <= (60)::numeric)))
);


--
-- Name: semester_gpas; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".semester_gpas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    academic_year integer NOT NULL,
    semester integer NOT NULL,
    gpa numeric(4,2) NOT NULL,
    cgpa numeric(4,2),
    total_credits integer NOT NULL,
    total_cumulative_credits integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: students; Type: TABLE; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc".students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matric_no character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    middle_name character varying(100),
    email character varying(200),
    phone character varying(20),
    date_of_birth date,
    gender character varying(10),
    nationality character varying(100) DEFAULT 'Nigerian'::character varying,
    state_of_origin character varying(100),
    address text,
    department_id uuid,
    program character varying(200),
    degree_type character varying(50) DEFAULT 'B.Sc.'::character varying,
    admission_year integer NOT NULL,
    expected_graduation integer,
    status character varying(30) DEFAULT 'active'::character varying,
    photo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: identities; Type: TABLE; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc_auth".identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    provider text NOT NULL,
    identity_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc_auth".users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    encrypted_password text,
    email_confirmed_at timestamp with time zone,
    phone text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    is_anonymous boolean DEFAULT false,
    phone_confirmed_at timestamp with time zone,
    confirmation_token text,
    confirmation_sent_at timestamp with time zone,
    recovery_token text,
    recovery_sent_at timestamp with time zone
);


--
-- Name: buckets; Type: TABLE; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc_storage".buckets (
    id text NOT NULL,
    name text NOT NULL,
    public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    file_size_limit bigint,
    allowed_mime_types text[]
);


--
-- Name: objects; Type: TABLE; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

CREATE TABLE "prj_uPH5TTGC6BEc_storage".objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    path_tokens text[],
    version text
);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".audit_logs (id, action, entity_type, entity_id, performed_by, details, ip_address, created_at) FROM stdin;
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".courses (id, code, title, credit_unit, department_id, level, semester, year, lecturer_id, description, is_elective, created_at) FROM stdin;
3d4d9818-01da-4461-8cb1-137ed19dce2f	CSC 101	Introduction to Computer Science	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	1	1	\N	Fundamentals of computing	f	2026-04-09 15:48:26.190213+00
f19b121b-aa0e-4a6b-a0b7-191fdde19f35	CSC 102	Introduction to Programming	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	1	1	\N	Programming basics using Python	f	2026-04-09 15:48:26.190213+00
0be01095-58c1-4973-afc6-aaa0047bfdcb	MTH 101	Mathematics for Computing I	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	1	1	\N	Calculus and linear algebra	f	2026-04-09 15:48:26.190213+00
edd09070-5c42-4a76-83d9-15e49622596f	GST 101	Use of English I	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	1	1	\N	Communication skills	f	2026-04-09 15:48:26.190213+00
4eb12853-dfcf-4d95-8fd2-b349313ce44a	CSC 103	Computer Hardware Fundamentals	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	1	1	\N	Computer architecture basics	f	2026-04-09 15:48:26.190213+00
3558466f-9dad-404b-bc06-7fad39c94f96	CSC 111	Data Structures	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	2	1	\N	Arrays, linked lists, trees	f	2026-04-09 15:48:26.190213+00
3d9d4de3-76a5-4c57-8ac9-4a9f43197908	CSC 112	Object-Oriented Programming	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	2	1	\N	OOP concepts using Java	f	2026-04-09 15:48:26.190213+00
17bda964-ce1b-4722-9d71-6cb9a6e76393	MTH 102	Mathematics for Computing II	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	2	1	\N	Discrete mathematics	f	2026-04-09 15:48:26.190213+00
edac65ee-c306-4f7f-a227-5c9e9244d6c7	GST 102	Use of English II	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	2	1	\N	Advanced communication	f	2026-04-09 15:48:26.190213+00
a0fa685f-eeaf-4cb9-acf4-b6920e75a713	CSC 113	Digital Logic Design	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	100	2	1	\N	Boolean algebra and circuits	f	2026-04-09 15:48:26.190213+00
2e4aaad4-327f-40da-9fca-47dfd1603207	CSC 201	Algorithms and Complexity	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	1	2	\N	Algorithm design and analysis	f	2026-04-09 15:48:39.161805+00
be7538b1-18d2-448b-a4af-a63ab92437b7	CSC 202	Database Management Systems	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	1	2	\N	Relational databases and SQL	f	2026-04-09 15:48:39.161805+00
aa9b6553-0754-43bf-b52d-c4cef1da8aee	CSC 203	Operating Systems	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	1	2	\N	OS concepts and design	f	2026-04-09 15:48:39.161805+00
f76721b7-240c-4179-a70c-2fa9df96a322	CSC 204	Computer Networks	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	1	2	\N	Networking fundamentals	f	2026-04-09 15:48:39.161805+00
524aae01-c02e-41e5-b748-d7f82d3c4b09	STA 201	Statistics for Computing	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	1	2	\N	Probability and statistics	f	2026-04-09 15:48:39.161805+00
cf60fadd-0225-46a3-9117-fe47e3fc312a	CSC 211	Software Engineering	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	2	2	\N	SDLC and methodologies	f	2026-04-09 15:48:39.161805+00
988ba4ec-d523-4161-950f-eb037c4e55a1	CSC 212	Web Technologies	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	2	2	\N	HTML, CSS, JavaScript	f	2026-04-09 15:48:39.161805+00
1790c6e2-734d-447f-b4be-99a97e915300	CSC 213	Systems Analysis and Design	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	2	2	\N	UML and system modeling	f	2026-04-09 15:48:39.161805+00
b172db2e-37ca-4770-a417-29b4f6caab6e	CSC 214	Assembly Language	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	2	2	\N	Low-level programming	f	2026-04-09 15:48:39.161805+00
e4567e5f-f54f-416b-8770-e3ccfcb3aa80	CSC 215	Computer Graphics	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	200	2	2	\N	Graphics algorithms	f	2026-04-09 15:48:39.161805+00
dd1d7213-3b38-4e6d-9e09-55ee55977377	CSC 301	Artificial Intelligence	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	1	3	\N	AI fundamentals	f	2026-04-09 15:48:39.161805+00
765de4f0-48ec-4955-9349-179d91a5f296	CSC 302	Compiler Design	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	1	3	\N	Lexical analysis and parsing	f	2026-04-09 15:48:39.161805+00
d8ea98be-33c9-435c-82da-7c0c86d26312	CSC 303	Information Security	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	1	3	\N	Cybersecurity principles	f	2026-04-09 15:48:39.161805+00
0589c418-9c4d-4001-afa9-db351bdd7645	CSC 304	Mobile App Development	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	1	3	\N	Android and iOS development	f	2026-04-09 15:48:39.161805+00
9443cc8e-33ac-42a5-9526-6a4fd35b48ec	CSC 305	Numerical Computing	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	1	3	\N	Numerical methods	f	2026-04-09 15:48:39.161805+00
ef0c901e-1600-4637-bdef-3464ed61e181	CSC 311	Machine Learning	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	2	3	\N	ML algorithms	f	2026-04-09 15:48:39.161805+00
e7591f95-f873-4ca1-9287-29e6d74eef93	CSC 312	Cloud Computing	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	2	3	\N	Cloud architecture	f	2026-04-09 15:48:39.161805+00
5a6539a4-3b3e-4c9d-9b19-7607b8d3374a	CSC 313	Human-Computer Interaction	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	2	3	\N	UX design principles	f	2026-04-09 15:48:39.161805+00
ca6186d6-335a-44a4-9d65-bda0235aaaed	CSC 314	Research Methodology	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	2	3	\N	Academic research methods	f	2026-04-09 15:48:39.161805+00
b392dbfe-3e05-47ba-8139-dfd470600645	CSC 315	Industrial Training	6	733bcdab-c57b-406c-b8db-7a03df3e1ac0	300	2	3	\N	SIWES industrial attachment	f	2026-04-09 15:48:39.161805+00
d1d97a42-cab6-49ae-9a4c-9bcf16d93853	CSC 401	Final Year Project I	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	1	4	\N	Project proposal and design	f	2026-04-09 15:48:39.161805+00
2b016f8c-0913-443f-a16b-c7bf9efe1557	CSC 402	Advanced Database Systems	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	1	4	\N	NoSQL and distributed databases	f	2026-04-09 15:48:39.161805+00
d2df1a08-6c74-431e-9007-4fb10cc05679	CSC 403	Distributed Systems	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	1	4	\N	Distributed computing	f	2026-04-09 15:48:39.161805+00
8946ef8f-dbc0-480a-be90-acb2efb3ad7c	CSC 404	Data Science	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	1	4	\N	Big data analytics	f	2026-04-09 15:48:39.161805+00
cd0f0ac5-6ac7-4cee-9e25-3e72dfdb97e7	CSC 405	Entrepreneurship	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	1	4	\N	Tech entrepreneurship	f	2026-04-09 15:48:39.161805+00
c481c208-2b68-4e9a-9d22-7855fdd598f2	CSC 411	Final Year Project II	6	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	2	4	\N	Project implementation	f	2026-04-09 15:48:39.161805+00
d4e4140d-a41c-4800-8f60-c44841321027	CSC 412	Emerging Technologies	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	2	4	\N	Blockchain, IoT, Quantum	f	2026-04-09 15:48:39.161805+00
3b2914b3-7662-466c-9899-2f0e8a3f19cd	CSC 413	Professional Ethics	2	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	2	4	\N	IT ethics and law	f	2026-04-09 15:48:39.161805+00
c952d1dd-f7a6-4ae3-86c5-77d953a25b89	CSC 414	Network Security	3	733bcdab-c57b-406c-b8db-7a03df3e1ac0	400	2	4	\N	Advanced security	f	2026-04-09 15:48:39.161805+00
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".departments (id, name, code, faculty, head_name, created_at) FROM stdin;
733bcdab-c57b-406c-b8db-7a03df3e1ac0	Computer Science	CS	Faculty of Computing	Dr. James Okonkwo	2026-04-09 15:47:31.386522+00
4473ea65-8917-451b-b6ef-02a9374a1a85	Business Information Systems	BIS	Faculty of Computing	Dr. Sarah Adeyemi	2026-04-09 15:47:31.386522+00
08cd0a8e-eff5-4d43-af1f-620c3e9f2529	Software Engineering	SE	Faculty of Computing	Prof. Michael Eze	2026-04-09 15:47:31.386522+00
16b3c3d9-575b-48cf-88f9-6a8629f1940a	Electrical Engineering	EE	Faculty of Engineering	Dr. Grace Nwosu	2026-04-09 15:47:31.386522+00
58a98e4c-5cef-41e2-8d37-a0baf615276b	Mechanical Engineering	ME	Faculty of Engineering	Prof. David Abubakar	2026-04-09 15:47:31.386522+00
a99f2ba0-6c0a-4b1a-b384-bbeab1e44e3c	Business Administration	BA	Faculty of Management Sciences	Dr. Fatima Hassan	2026-04-09 15:47:31.386522+00
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".documents (id, student_id, file_name, file_url, file_type, document_type, verified, uploaded_at) FROM stdin;
\.


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".enrollments (id, student_id, course_id, academic_year, semester, status, enrolled_at) FROM stdin;
\.


--
-- Data for Name: lecturers; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".lecturers (id, staff_id, first_name, last_name, title, email, phone, department_id, specialization, photo_url, status, created_at) FROM stdin;
bfc56f21-86ed-4937-adc2-0f8366d91f29	STF/2020/001	James	Okonkwo	Dr.	j.okonkwo@uni.edu	\N	733bcdab-c57b-406c-b8db-7a03df3e1ac0	Artificial Intelligence	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749428122_5e19cbff.jpg	active	2026-04-09 15:48:19.923755+00
28ec088b-62fe-4569-9bc9-82c60917c3ea	STF/2020/002	Sarah	Adeyemi	Dr.	s.adeyemi@uni.edu	\N	4473ea65-8917-451b-b6ef-02a9374a1a85	Information Systems	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749435689_3700159e.jpg	active	2026-04-09 15:48:19.923755+00
d51e3672-1f40-4073-ba32-b4257c4de0b1	STF/2020/003	Michael	Eze	Prof.	m.eze@uni.edu	\N	08cd0a8e-eff5-4d43-af1f-620c3e9f2529	Software Architecture	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749463982_121406f0.png	active	2026-04-09 15:48:19.923755+00
47e20658-3ba6-4f1a-9a0e-b56ef75fbb80	STF/2020/004	David	Abubakar	Prof.	d.abubakar@uni.edu	\N	58a98e4c-5cef-41e2-8d37-a0baf615276b	Thermodynamics	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749428316_b24f9443.jpg	active	2026-04-09 15:48:19.923755+00
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".profiles (id, email, full_name, role, student_id, lecturer_id, avatar_url, matric_no, staff_id, created_at, updated_at) FROM stdin;
e7aaf1d9-3822-42ee-873e-d89e103bfeb3	tchamer@aol.com	User	student	\N	\N	\N	\N	\N	2026-04-09 16:09:28.546181+00	2026-04-09 16:09:28.546181+00
af03e401-ea8e-413f-8902-fed55fb99cb4	vc@iguc.net	User	student	\N	\N	\N	\N	\N	2026-04-09 16:14:00.929989+00	2026-04-09 16:14:00.929989+00
f566fa24-f075-4758-9ae2-888f5a6a0c7d	admin@aol.com	User	student	\N	\N	\N	\N	\N	2026-04-09 16:16:34.725278+00	2026-04-09 16:16:34.725278+00
\.


--
-- Data for Name: results; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".results (id, student_id, course_id, enrollment_id, ca_score, exam_score, grade, grade_point, status, submitted_by, approved_by, submitted_at, approved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: semester_gpas; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".semester_gpas (id, student_id, academic_year, semester, gpa, cgpa, total_credits, total_cumulative_credits, created_at) FROM stdin;
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc; Owner: -
--

COPY "prj_uPH5TTGC6BEc".students (id, matric_no, first_name, last_name, middle_name, email, phone, date_of_birth, gender, nationality, state_of_origin, address, department_id, program, degree_type, admission_year, expected_graduation, status, photo_url, created_at, updated_at) FROM stdin;
be83d0c6-5cb0-48be-a5f5-ed0090b5fce7	UNI/2022/CS/001	Adebayo	Oluwaseun	Michael	adebayo.o@uni.edu	+2348012345678	2000-05-15	Male	Nigerian	Lagos	\N	733bcdab-c57b-406c-b8db-7a03df3e1ac0	Computer Science	B.Sc.	2022	2026	active	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749569308_8c6d4c22.png	2026-04-09 15:48:50.320277+00	2026-04-09 15:48:50.320277+00
7ac3373b-92a1-4ac6-bda3-3c6cee2dff9a	UNI/2022/CS/002	Chidinma	Nwankwo	Grace	chidinma.n@uni.edu	+2348023456789	2001-03-22	Female	Nigerian	Anambra	\N	733bcdab-c57b-406c-b8db-7a03df3e1ac0	Computer Science	B.Sc.	2022	2026	active	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749510527_0843627c.png	2026-04-09 15:48:50.320277+00	2026-04-09 15:48:50.320277+00
e3d7b2ce-eb1b-4022-9acd-0694182cbe4f	UNI/2022/CS/003	Ibrahim	Musa	Abdullahi	ibrahim.m@uni.edu	+2348034567890	2000-11-08	Male	Nigerian	Kano	\N	733bcdab-c57b-406c-b8db-7a03df3e1ac0	Computer Science	B.Sc.	2022	2026	active	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749539720_8546a178.png	2026-04-09 15:48:50.320277+00	2026-04-09 15:48:50.320277+00
896766e7-78ac-4f60-a9ba-9ad01a6a1546	UNI/2022/CS/004	Folake	Adeyemi	Blessing	folake.a@uni.edu	+2348045678901	2001-07-30	Female	Nigerian	Oyo	\N	733bcdab-c57b-406c-b8db-7a03df3e1ac0	Computer Science	B.Sc.	2022	2026	active	https://d64gsuwffb70l.cloudfront.net/69d7c86adbb6212cee108ac6_1775749546851_7c9916a1.png	2026-04-09 15:48:50.320277+00	2026-04-09 15:48:50.320277+00
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

COPY "prj_uPH5TTGC6BEc_auth".identities (id, user_id, provider, identity_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

COPY "prj_uPH5TTGC6BEc_auth".users (id, email, encrypted_password, email_confirmed_at, phone, created_at, updated_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_anonymous, phone_confirmed_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at) FROM stdin;
af03e401-ea8e-413f-8902-fed55fb99cb4	vc@iguc.net	$2b$10$lH6eevCP7RYe2cqd9YTVx.cioP0GxVfcQBedxlES/5XEZ0bGlbriq	2026-04-09 16:13:59.877+00	\N	2026-04-09 16:13:59.877+00	2026-04-09 16:13:59.877+00	\N	{}	{}	f	\N	\N	\N	\N	\N
e7aaf1d9-3822-42ee-873e-d89e103bfeb3	tchamer@aol.com	$2b$10$Yv946ioBW.SBhGs0gNVeEOJzDKRJm9EyHuI2BRtFZ/NmE0ihuQCYy	2026-04-09 16:09:27.921+00	\N	2026-04-09 16:09:27.921+00	2026-04-09 16:15:27.728+00	2026-04-09 16:15:27.728+00	{}	{}	f	\N	\N	\N	\N	\N
f566fa24-f075-4758-9ae2-888f5a6a0c7d	admin@aol.com	$2b$10$Jcr5vwnde3gsWRL.vcsMXOoYjwIYe2WvWQrAtmzXw/YCExPIbQ7Dm	2026-04-09 16:16:33.824+00	\N	2026-04-09 16:16:33.824+00	2026-04-09 16:19:52.074+00	2026-04-09 16:19:52.074+00	{}	{}	f	\N	\N	\N	\N	\N
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

COPY "prj_uPH5TTGC6BEc_storage".buckets (id, name, public, created_at, updated_at, file_size_limit, allowed_mime_types) FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

COPY "prj_uPH5TTGC6BEc_storage".objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, path_tokens, version) FROM stdin;
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: courses courses_code_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".courses
    ADD CONSTRAINT courses_code_key UNIQUE (code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_student_id_course_id_academic_year_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".enrollments
    ADD CONSTRAINT enrollments_student_id_course_id_academic_year_key UNIQUE (student_id, course_id, academic_year);


--
-- Name: lecturers lecturers_email_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".lecturers
    ADD CONSTRAINT lecturers_email_key UNIQUE (email);


--
-- Name: lecturers lecturers_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".lecturers
    ADD CONSTRAINT lecturers_pkey PRIMARY KEY (id);


--
-- Name: lecturers lecturers_staff_id_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".lecturers
    ADD CONSTRAINT lecturers_staff_id_key UNIQUE (staff_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: results results_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- Name: semester_gpas semester_gpas_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".semester_gpas
    ADD CONSTRAINT semester_gpas_pkey PRIMARY KEY (id);


--
-- Name: semester_gpas semester_gpas_student_id_academic_year_semester_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".semester_gpas
    ADD CONSTRAINT semester_gpas_student_id_academic_year_semester_key UNIQUE (student_id, academic_year, semester);


--
-- Name: students students_email_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".students
    ADD CONSTRAINT students_email_key UNIQUE (email);


--
-- Name: students students_matric_no_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".students
    ADD CONSTRAINT students_matric_no_key UNIQUE (matric_no);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_auth".identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_auth".users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_auth".users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_name_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_storage".buckets
    ADD CONSTRAINT buckets_name_key UNIQUE (name);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_storage".buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: objects objects_bucket_id_name_key; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_storage".objects
    ADD CONSTRAINT objects_bucket_id_name_key UNIQUE (bucket_id, name);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_storage".objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: idx_identities_user_id; Type: INDEX; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE INDEX idx_identities_user_id ON "prj_uPH5TTGC6BEc_auth".identities USING btree (user_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON "prj_uPH5TTGC6BEc_auth".users FOR EACH ROW EXECUTE FUNCTION "prj_uPH5TTGC6BEc".handle_new_user();


--
-- Name: courses courses_department_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".courses
    ADD CONSTRAINT courses_department_id_fkey FOREIGN KEY (department_id) REFERENCES "prj_uPH5TTGC6BEc".departments(id);


--
-- Name: courses courses_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".courses
    ADD CONSTRAINT courses_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES "prj_uPH5TTGC6BEc".lecturers(id);


--
-- Name: documents documents_student_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".documents
    ADD CONSTRAINT documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES "prj_uPH5TTGC6BEc".students(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".enrollments
    ADD CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES "prj_uPH5TTGC6BEc".courses(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES "prj_uPH5TTGC6BEc".students(id) ON DELETE CASCADE;


--
-- Name: lecturers lecturers_department_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".lecturers
    ADD CONSTRAINT lecturers_department_id_fkey FOREIGN KEY (department_id) REFERENCES "prj_uPH5TTGC6BEc".departments(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES "prj_uPH5TTGC6BEc_auth".users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".profiles
    ADD CONSTRAINT profiles_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES "prj_uPH5TTGC6BEc".lecturers(id);


--
-- Name: profiles profiles_student_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".profiles
    ADD CONSTRAINT profiles_student_id_fkey FOREIGN KEY (student_id) REFERENCES "prj_uPH5TTGC6BEc".students(id);


--
-- Name: results results_course_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".results
    ADD CONSTRAINT results_course_id_fkey FOREIGN KEY (course_id) REFERENCES "prj_uPH5TTGC6BEc".courses(id) ON DELETE CASCADE;


--
-- Name: results results_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".results
    ADD CONSTRAINT results_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES "prj_uPH5TTGC6BEc".enrollments(id);


--
-- Name: results results_student_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".results
    ADD CONSTRAINT results_student_id_fkey FOREIGN KEY (student_id) REFERENCES "prj_uPH5TTGC6BEc".students(id) ON DELETE CASCADE;


--
-- Name: results results_submitted_by_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".results
    ADD CONSTRAINT results_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES "prj_uPH5TTGC6BEc".lecturers(id);


--
-- Name: semester_gpas semester_gpas_student_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".semester_gpas
    ADD CONSTRAINT semester_gpas_student_id_fkey FOREIGN KEY (student_id) REFERENCES "prj_uPH5TTGC6BEc".students(id) ON DELETE CASCADE;


--
-- Name: students students_department_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc".students
    ADD CONSTRAINT students_department_id_fkey FOREIGN KEY (department_id) REFERENCES "prj_uPH5TTGC6BEc".departments(id);


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_auth".identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES "prj_uPH5TTGC6BEc_auth".users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

ALTER TABLE ONLY "prj_uPH5TTGC6BEc_storage".objects
    ADD CONSTRAINT objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES "prj_uPH5TTGC6BEc_storage".buckets(id) ON DELETE CASCADE;


--
-- Name: profiles Admins can read all profiles; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Admins can read all profiles" ON "prj_uPH5TTGC6BEc".profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "prj_uPH5TTGC6BEc".profiles profiles_1
  WHERE ((profiles_1.id = (NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid) AND ((profiles_1.role)::text = 'admin'::text)))));


--
-- Name: profiles Allow insert during signup; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow insert during signup" ON "prj_uPH5TTGC6BEc".profiles FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs Allow public insert on audit_logs; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public insert on audit_logs" ON "prj_uPH5TTGC6BEc".audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: courses Allow public insert on courses; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public insert on courses" ON "prj_uPH5TTGC6BEc".courses FOR INSERT WITH CHECK (true);


--
-- Name: documents Allow public insert on documents; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public insert on documents" ON "prj_uPH5TTGC6BEc".documents FOR INSERT WITH CHECK (true);


--
-- Name: enrollments Allow public insert on enrollments; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public insert on enrollments" ON "prj_uPH5TTGC6BEc".enrollments FOR INSERT WITH CHECK (true);


--
-- Name: results Allow public insert on results; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public insert on results" ON "prj_uPH5TTGC6BEc".results FOR INSERT WITH CHECK (true);


--
-- Name: semester_gpas Allow public insert on semester_gpas; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public insert on semester_gpas" ON "prj_uPH5TTGC6BEc".semester_gpas FOR INSERT WITH CHECK (true);


--
-- Name: students Allow public insert on students; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public insert on students" ON "prj_uPH5TTGC6BEc".students FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs Allow public read on audit_logs; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on audit_logs" ON "prj_uPH5TTGC6BEc".audit_logs FOR SELECT USING (true);


--
-- Name: courses Allow public read on courses; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on courses" ON "prj_uPH5TTGC6BEc".courses FOR SELECT USING (true);


--
-- Name: departments Allow public read on departments; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on departments" ON "prj_uPH5TTGC6BEc".departments FOR SELECT USING (true);


--
-- Name: documents Allow public read on documents; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on documents" ON "prj_uPH5TTGC6BEc".documents FOR SELECT USING (true);


--
-- Name: enrollments Allow public read on enrollments; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on enrollments" ON "prj_uPH5TTGC6BEc".enrollments FOR SELECT USING (true);


--
-- Name: lecturers Allow public read on lecturers; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on lecturers" ON "prj_uPH5TTGC6BEc".lecturers FOR SELECT USING (true);


--
-- Name: results Allow public read on results; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on results" ON "prj_uPH5TTGC6BEc".results FOR SELECT USING (true);


--
-- Name: semester_gpas Allow public read on semester_gpas; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on semester_gpas" ON "prj_uPH5TTGC6BEc".semester_gpas FOR SELECT USING (true);


--
-- Name: students Allow public read on students; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public read on students" ON "prj_uPH5TTGC6BEc".students FOR SELECT USING (true);


--
-- Name: results Allow public update on results; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public update on results" ON "prj_uPH5TTGC6BEc".results FOR UPDATE USING (true);


--
-- Name: semester_gpas Allow public update on semester_gpas; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public update on semester_gpas" ON "prj_uPH5TTGC6BEc".semester_gpas FOR UPDATE USING (true);


--
-- Name: students Allow public update on students; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Allow public update on students" ON "prj_uPH5TTGC6BEc".students FOR UPDATE USING (true);


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Users can read own profile" ON "prj_uPH5TTGC6BEc".profiles FOR SELECT USING (((NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid = id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

CREATE POLICY "Users can update own profile" ON "prj_uPH5TTGC6BEc".profiles FOR UPDATE USING (((NULLIF(current_setting('request.jwt.claim.sub'::text, true), ''::text))::uuid = id));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".courses ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".departments ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".documents ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: lecturers; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".lecturers ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: results; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".results ENABLE ROW LEVEL SECURITY;

--
-- Name: semester_gpas; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".semester_gpas ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc".students ENABLE ROW LEVEL SECURITY;

--
-- Name: users Admin can delete all users; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Admin can delete all users" ON "prj_uPH5TTGC6BEc_auth".users FOR DELETE TO "prj_uPH5TTGC6BEc_role" USING (true);


--
-- Name: identities Admin can delete identities; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Admin can delete identities" ON "prj_uPH5TTGC6BEc_auth".identities FOR DELETE TO "prj_uPH5TTGC6BEc_role" USING (true);


--
-- Name: users Admin can insert users; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Admin can insert users" ON "prj_uPH5TTGC6BEc_auth".users FOR INSERT TO "prj_uPH5TTGC6BEc_role" WITH CHECK (true);


--
-- Name: users Admin can update all users; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Admin can update all users" ON "prj_uPH5TTGC6BEc_auth".users FOR UPDATE TO "prj_uPH5TTGC6BEc_role" USING (true);


--
-- Name: users Admin can view all users; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Admin can view all users" ON "prj_uPH5TTGC6BEc_auth".users FOR SELECT TO "prj_uPH5TTGC6BEc_role" USING (true);


--
-- Name: identities Users can delete own identities; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can delete own identities" ON "prj_uPH5TTGC6BEc_auth".identities FOR DELETE USING ((user_id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: users Users can delete own profile; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can delete own profile" ON "prj_uPH5TTGC6BEc_auth".users FOR DELETE USING ((id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: identities Users can insert own identities; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can insert own identities" ON "prj_uPH5TTGC6BEc_auth".identities FOR INSERT WITH CHECK ((user_id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: users Users can insert own profile; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can insert own profile" ON "prj_uPH5TTGC6BEc_auth".users FOR INSERT WITH CHECK ((id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: identities Users can update own identities; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can update own identities" ON "prj_uPH5TTGC6BEc_auth".identities FOR UPDATE USING ((user_id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: users Users can update own profile; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can update own profile" ON "prj_uPH5TTGC6BEc_auth".users FOR UPDATE USING ((id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: identities Users can view own identities; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can view own identities" ON "prj_uPH5TTGC6BEc_auth".identities FOR SELECT USING ((user_id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: users Users can view own profile; Type: POLICY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

CREATE POLICY "Users can view own profile" ON "prj_uPH5TTGC6BEc_auth".users FOR SELECT USING ((id = "prj_uPH5TTGC6BEc_auth".auth_uid()));


--
-- Name: identities; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc_auth".identities ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc_auth; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc_auth".users ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets Service role can manage buckets; Type: POLICY; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

CREATE POLICY "Service role can manage buckets" ON "prj_uPH5TTGC6BEc_storage".buckets USING (true);


--
-- Name: objects Service role can manage objects; Type: POLICY; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

CREATE POLICY "Service role can manage objects" ON "prj_uPH5TTGC6BEc_storage".objects USING (true);


--
-- Name: buckets; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc_storage".buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: prj_uPH5TTGC6BEc_storage; Owner: -
--

ALTER TABLE "prj_uPH5TTGC6BEc_storage".objects ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


