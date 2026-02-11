"""
Comprehensive test suite for reorganize_sin.py v3
Covers:
  - VIN helpers & categorization
  - Filename standardization (essential info preserved)
  - All planning edge cases (VIN, nested, contracte, multi-car, flat, empty)
  - V2 regression: contracte duplication, VIN nesting, empty folder removal
  - Threading safety: concurrent writes, collision handling, JSONL integrity
  - Idempotency: re-runs skip identical files
  - Excel inventory: creation, merge, update
"""
import os
import sys
import json
import shutil
import tempfile
import threading
from pathlib import Path
from collections import defaultdict, Counter

sys.path.insert(0, '/home/claude')
import reorganize_sin as rs

PASS = 0
FAIL = 0


def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name}  {detail}")


def make_pdf(path: Path, content: str = "dummy"):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content.encode())


def build_full_test_tree(root: Path):
    """Realistic tree covering every folder type encountered in production."""
    part = root / "SINDICALIZARE ALPHA FINAL - Part 1"

    # --- 1. VIN-named folder (simple copy) ---
    vin1 = part / "UU1DJF01873953007"
    make_pdf(vin1 / "FL - DACIA DUSTER, Alb - UU1DJF01873953007.pdf", "fl1")
    make_pdf(vin1 / "seriec_UU1DJF01873953007_ctr cadru_Contract Cadru Leasing.pdf", "s1")
    make_pdf(vin1 / "POLITA_RCA_28337197.pdf", "rca1")
    make_pdf(vin1 / "OP SERVICE AUTO SRL 11.03.2025.PDF", "op1")
    make_pdf(vin1 / "Subcontract Leasing Operational nr1.pdf", "sub1")
    make_pdf(vin1 / "324. Cesiune ALPHA BANK 24.04.2025.pdf", "ces1")

    # --- 2. VIN folder with nested VIN (must elevate) ---
    vin2 = part / "ABCDE2345678901AB"
    make_pdf(vin2 / "seriec_ABCDE2345678901AB_doc.pdf", "main")
    nested = vin2 / "XYZDE8765432109AB"
    make_pdf(nested / "FL - FORD FOCUS - XYZDE8765432109AB.pdf", "nested_fl")
    make_pdf(nested / "POLITA_RCA_99999999.pdf", "nested_rca")

    # --- 3. VIN folder with contracte/ subfolder ---
    vin3 = part / "JM4BP6HE60116024A"
    make_pdf(vin3 / "FL - MAZDA CX5 - JM4BP6HE60116024A.pdf", "fl3")
    make_pdf(vin3 / "contracte" / "Contract Cadru Leasing.pdf", "ctr3")
    make_pdf(vin3 / "contracte" / "Subcontract Leasing nr1.pdf", "sub3")

    # --- 4. Multi-car folder (descriptive name, VIN subdirs) ---
    multi = part / "3 FORD KUGA - 2CONNECT SUBCT 1"
    vsub1 = multi / "FORD111111111111A"
    make_pdf(vsub1 / "FL - FORD KUGA - FORD111111111111A.pdf", "fl_f1")
    make_pdf(vsub1 / "seriec_FORD111111111111A_doc.pdf", "seriec_f1")
    vsub2 = multi / "FORD222222222222B"
    make_pdf(vsub2 / "FL - FORD KUGA - FORD222222222222B.pdf", "fl_f2")
    # Loose files at root → parent VIN
    make_pdf(multi / "Contract Cadru Leasing_2CONNECT.pdf", "ctr_multi")
    # contracte/ → parent VIN
    make_pdf(multi / "contracte" / "Subcontract Leasing.pdf", "sub_multi")

    # --- 5. Flat single-VIN folder ---
    flat1 = part / "2 dacia logan - farmaceutica subct 4"
    make_pdf(flat1 / "FL - DACIA LOGAN - DACIA12345678901A.pdf", "fl_flat")
    make_pdf(flat1 / "seriec_DACIA12345678901A_Atasament.PDF", "seriec_flat")
    make_pdf(flat1 / "POLITA_RCA_12345678.pdf", "rca_flat")
    make_pdf(flat1 / "Factura dacia logan.pdf", "fact_flat")

    # --- 6. Flat multi-VIN folder (split) ---
    flat2 = part / "2 RENAULT MASTER - AGROMEC SUBCT 1"
    make_pdf(flat2 / "FL - RENAULT - RENLT12345678901A.pdf", "fl_r1")
    make_pdf(flat2 / "seriec_RENLT12345678901A_doc.pdf", "seriec_r1")
    make_pdf(flat2 / "RNLT198765432109A - Supliment Cesiune.pdf", "sup_r2")
    make_pdf(flat2 / "Factura RNLT198765432109A.pdf", "fact_r2")

    # --- 7. Empty folder ---
    (part / "EMPTY FOLDER TEST").mkdir(parents=True, exist_ok=True)

    # --- 8. Flat folder with VIN-named subfolder inside ---
    flat3 = part / "5 TOYOTA COROLLA - ALPHA BANK SUBCT 3"
    make_pdf(flat3 / "FL - TOYOTA - TOYOT12345678901A.pdf", "fl_toy")
    sub_vin = flat3 / "TOYOT12345678901A"
    make_pdf(sub_vin / "seriec_TOYOT12345678901A_extra.pdf", "seriec_toy")

    # --- 9. Multi-car folder where loose files have NO VIN in name ---
    multi2 = part / "4 HYUNDAI KONA - ALPHA BANK SUBCT 3"
    vsub3 = multi2 / "KMHHC811111111111"
    make_pdf(vsub3 / "FL - HYUNDAI - KMHHC811111111111.pdf", "fl_h1")
    vsub4 = multi2 / "KMHHC822222222222"
    make_pdf(vsub4 / "FL - HYUNDAI - KMHHC822222222222.pdf", "fl_h2")
    # Loose file with NO VIN → should go to first VIN subdir (fallback)
    make_pdf(multi2 / "General info document.pdf", "general")
    make_pdf(multi2 / "contracte" / "Master contract.pdf", "master_ctr")

    return part


# ═══════════════════════════════════════════════════════════════════════════
# TEST GROUPS
# ═══════════════════════════════════════════════════════════════════════════

def test_vin_helpers():
    print("\n=== VIN Helpers ===")
    check("valid VIN", rs.is_valid_vin("UU1DJF01873953007"))
    check("invalid: all letters", not rs.is_valid_vin("ABCDEFGHIJKLMNOPQ"))
    check("invalid: all digits", not rs.is_valid_vin("12345678901234567"))
    check("is_vin positive", rs.is_vin("UU1DJF01873953007"))
    check("is_vin negative", not rs.is_vin("2 dacia logan"))
    check("is_vin with spaces", not rs.is_vin("  "))

    check("extract from FL",
          rs.extract_vin_from_filename("FL - DACIA DUSTER, Alb - UU1DJF01873953007.pdf")
          == "UU1DJF01873953007")
    check("extract from FL no trailing",
          rs.extract_vin_from_filename("FL - CAR - ABCDE2345678901AB.pdf")
          == "ABCDE2345678901AB")
    check("extract from seriec",
          rs.extract_vin_from_filename("seriec_UU1DJF01873953007_doc.pdf")
          == "UU1DJF01873953007")
    check("extract from VIN-prefix",
          rs.extract_vin_from_filename("UU1DJF01873953007_doc.pdf")
          == "UU1DJF01873953007")
    check("extract multi VINs",
          set(rs.extract_all_vins("ABCDE2345678901AB and XYZDE8765432109AB"))
          == {"ABCDE2345678901AB", "XYZDE8765432109AB"})


def test_categorization():
    print("\n=== Document Categorization ===")
    tests = [
        ("FL - DACIA - VIN.pdf", "Formular de Livrare (FL)"),
        ("fl VIN.pdf", "Formular de Livrare (FL)"),
        ("Contract Cadru Leasing.pdf", "Contract Cadru"),
        ("ctr cadru document.pdf", "Contract Cadru"),
        ("Subcontract Leasing nr1.pdf", "Subcontract"),
        ("POLITA_RCA_28337197.pdf", "RCA"),
        ("FlexiCasco policy.pdf", "CASCO"),
        ("Polita DT NV000108.pdf", "CASCO"),
        ("Factura Toyota.pdf", "Facturi"),
        ("F.FINALA doc.pdf", "Facturi"),
        ("OP SERVICE AUTO SRL.pdf", "OP Plăți"),
        ("324. Cesiune ALPHA BANK.pdf", "Cesiune / Supliment"),
        ("Supliment nr 2 contract.pdf", "Cesiune / Supliment"),
        ("TALON_B 925 BMG.pdf", "TALON / CIV"),
        ("CIV+COC doc.pdf", "TALON / CIV"),
        ("random_document.pdf", "Alte Documente"),
        # Configurare/Ofertă and seriec with no keyword → Alte Documente
        ("Configurare auto.pdf", "Alte Documente"),
        ("Oferta vehicul.pdf", "Alte Documente"),
        ("seriec_VIN_doc.pdf", "Alte Documente"),
        ("seriec_VIN_2_something.pdf", "Alte Documente"),
        # Factura takes priority over other keywords
        ("Factura Cesiune company.pdf", "Facturi"),
        ("Supliment Factura nr 3.pdf", "Facturi"),
        ("factura_subcontract_doc.pdf", "Facturi"),
        # TALON/CIV takes priority (even inside seriec_ files)
        ("seriec_VIN_TALON_B 925 BMG.pdf", "TALON / CIV"),
        ("seriec_VIN_CIV+COC doc.pdf", "TALON / CIV"),
        # Specific keywords inside seriec_ files override the seriec prefix
        ("seriec_VIN_ctr cadru_Contract Cadru Leasing.pdf", "Contract Cadru"),
        ("seriec_VIN_sub1_Subcontract Leasing.pdf", "Subcontract"),
        ("seriec_VIN_Cesiune ALPHA BANK.pdf", "Cesiune / Supliment"),
        ("seriec_VIN_Factura Toyota.pdf", "Facturi"),
        # System files ignored (return None)
        ("desktop.ini", None),
        ("Thumbs.db", None),
    ]
    for fn, expected_cat in tests:
        actual = rs.categorize_file(fn)
        check(f"{fn} → {expected_cat}", actual == expected_cat,
              f"got '{actual}'")

    # Test PDF content category detection
    print("  --- Content category detection ---")
    check("content: Contract Cadru",
          "Contract Cadru" in rs._detect_content_categories("CONTRACT CADRU LEASING"))
    check("content: Leasing Operational",
          "Contract Cadru" in rs._detect_content_categories("LEASING OPERAȚIONAL NR 123"))
    check("content: Subcontract",
          "Subcontract" in rs._detect_content_categories("SUBCONTRACT NR 2"))
    check("content: CASCO",
          "CASCO" in rs._detect_content_categories("POLITA CASCO FLEXICASCO"))
    check("content: RCA",
          "RCA" in rs._detect_content_categories("ASIGURARE RCA OBLIGATORIE"))
    check("content: no match",
          len(rs._detect_content_categories("RANDOM TEXT ABOUT CARS")) == 0)
    check("content: multiple categories",
          rs._detect_content_categories("CONTRACT CADRU AND RCA POLICY") == {"Contract Cadru", "RCA"})


def test_category_renames():
    print("\n=== Category-Aware Renaming ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        def mk(name, content="default"):
            p = tmpdir / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(content.encode())
            return str(p)

        vin = "TESTVN1234567890A"
        out_base = f"/fake/output/PART/{vin}"

        # --- Contract Cadru -> cc.pdf ---
        ledger = rs.Ledger()
        src = mk("ctr1.pdf", "contract_content_1")
        ledger.add("copy_file", src, f"{out_base}/Contract Cadru Leasing Operational.pdf",
                    vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("contract single -> cc.pdf", dst_name == "cc.pdf", f"got {dst_name}")
        check("cc original tracked", orig.get((vin, "cc.pdf")) ==
              "Contract Cadru Leasing Operational.pdf")

        # --- Contract Cadru: two identical -> dedup ---
        ledger = rs.Ledger()
        src1 = mk("ctr_a.pdf", "same_content")
        src2 = mk("ctr_b.pdf", "same_content")
        ledger.add("copy_file", src1, f"{out_base}/Contract Cadru Leasing.pdf", vin=vin)
        ledger.add("copy_file", src2, f"{out_base}/ctr cadru copy.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        ctr_changes = [c for c in ledger.changes
                       if c.action == "copy_file" and "cc" in Path(c.destination).name]
        check("identical contracts deduped to 1", len(ctr_changes) == 1,
              f"got {len(ctr_changes)}")

        # --- Contract Cadru: two different -> cc_1, cc_2 ---
        ledger = rs.Ledger()
        src1 = mk("ctr_x.pdf", "content_alpha")
        src2 = mk("ctr_y.pdf", "content_beta")
        ledger.add("copy_file", src1, f"{out_base}/Contract Cadru v1.pdf", vin=vin)
        ledger.add("copy_file", src2, f"{out_base}/Contract Cadru v2.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        names = sorted(Path(c.destination).name for c in ledger.changes if c.action == "copy_file")
        check("different contracts numbered", names == ["cc_1.pdf", "cc_2.pdf"],
              f"got {names}")

        # --- Subcontract -> subct.pdf ---
        ledger = rs.Ledger()
        src = mk("sub.pdf", "sub_content")
        ledger.add("copy_file", src, f"{out_base}/Subcontract Leasing nr1.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("subcontract -> subct.pdf", dst_name == "subct.pdf", f"got {dst_name}")

        # --- FL -> fl.pdf ---
        ledger = rs.Ledger()
        src = mk("fl.pdf", "fl_content")
        ledger.add("copy_file", src, f"{out_base}/FL - DACIA DUSTER - {vin}.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("FL -> fl.pdf", dst_name == "fl.pdf", f"got {dst_name}")
        check("FL original tracked", "FL - DACIA DUSTER" in orig.get((vin, "fl.pdf"), ""))

        # --- Two different FL -> fl_1, fl_2 ---
        ledger = rs.Ledger()
        src1 = mk("fl_a.pdf", "fl_v1")
        src2 = mk("fl_b.pdf", "fl_v2")
        ledger.add("copy_file", src1, f"{out_base}/FL - DACIA - {vin}.pdf", vin=vin)
        ledger.add("copy_file", src2, f"{out_base}/FL - TOYOTA - {vin}.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        names = sorted(Path(c.destination).name for c in ledger.changes if c.action == "copy_file")
        check("different FL numbered", names == ["fl_1.pdf", "fl_2.pdf"], f"got {names}")

        # --- TALON+CIV combined ---
        ledger = rs.Ledger()
        src = mk("tc.pdf", "talon_civ")
        ledger.add("copy_file", src, f"{out_base}/seriec_{vin}_TALON_CIV doc.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("TALON+CIV combined", dst_name == "TALON+CIV.pdf", f"got {dst_name}")

        # --- TALON only ---
        ledger = rs.Ledger()
        src = mk("t.pdf", "talon_only")
        ledger.add("copy_file", src, f"{out_base}/TALON_B 925 BMG.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("TALON only -> talon.pdf", dst_name == "talon.pdf", f"got {dst_name}")

        # --- CIV only ---
        ledger = rs.Ledger()
        src = mk("c.pdf", "civ_only")
        ledger.add("copy_file", src, f"{out_base}/CIV+COC doc.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("CIV only -> civ.pdf", dst_name == "civ.pdf", f"got {dst_name}")

        # --- CASCO -> casco.pdf ---
        ledger = rs.Ledger()
        src = mk("casco.pdf", "casco_content")
        ledger.add("copy_file", src,
                    f"{out_base}/PolitaFlexiCascoNrCPJ171860340AnnexeNr1_2.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("CASCO -> casco.pdf", dst_name == "casco.pdf", f"got {dst_name}")

        # --- CASCO: two identical -> dedup ---
        ledger = rs.Ledger()
        src1 = mk("casco_a.pdf", "same_casco")
        src2 = mk("casco_b.pdf", "same_casco")
        ledger.add("copy_file", src1, f"{out_base}/PolitaFlexiCascoNrCPJ999.pdf", vin=vin)
        ledger.add("copy_file", src2, f"{out_base}/FlexiCasco copy.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        casco_changes = [c for c in ledger.changes if c.action == "copy_file"]
        check("identical CASCO deduped to 1", len(casco_changes) == 1,
              f"got {len(casco_changes)}")
        dst_name = Path(casco_changes[0].destination).name
        check("CASCO dedup -> casco.pdf", dst_name == "casco.pdf", f"got {dst_name}")

        # --- CASCO: two different -> casco_1, casco_2 ---
        ledger = rs.Ledger()
        src1 = mk("casco_x.pdf", "casco_alpha")
        src2 = mk("casco_y.pdf", "casco_beta")
        ledger.add("copy_file", src1, f"{out_base}/PolitaFlexiCascoNrCPJ111.pdf", vin=vin)
        ledger.add("copy_file", src2, f"{out_base}/CASCO renewal 2025.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        names = sorted(Path(c.destination).name for c in ledger.changes if c.action == "copy_file")
        check("different CASCO numbered", names == ["casco_1.pdf", "casco_2.pdf"],
              f"got {names}")

        # --- RCA -> rca.pdf ---
        ledger = rs.Ledger()
        src = mk("rca.pdf", "rca_content")
        ledger.add("copy_file", src, f"{out_base}/POLITA_RCA_28337197.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("RCA -> rca.pdf", dst_name == "rca.pdf", f"got {dst_name}")

        # --- OP -> op.pdf ---
        ledger = rs.Ledger()
        src = mk("op.pdf", "op_content")
        ledger.add("copy_file", src, f"{out_base}/OP SERVICE AUTO SRL.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("OP -> op.pdf", dst_name == "op.pdf", f"got {dst_name}")

        # --- Factura -> fact.pdf ---
        ledger = rs.Ledger()
        src = mk("factura.pdf", "factura_content")
        ledger.add("copy_file", src, f"{out_base}/Factura Toyota Highlander.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("Factura -> fact.pdf", dst_name == "fact.pdf", f"got {dst_name}")

        # --- Cesiune -> ces.pdf ---
        ledger = rs.Ledger()
        src = mk("ces1.pdf", "cesiune_content")
        ledger.add("copy_file", src,
                    f"{out_base}/WMW21GD0802X25470 - Supliment Cesiune - Autonom ALPHA - 13.05.pdf",
                    vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("cesiune -> ces.pdf",
              dst_name == "ces.pdf", f"got {dst_name}")

        # --- Cesiune: two different -> numbered ---
        ledger = rs.Ledger()
        src1 = mk("ces_x.pdf", "cesiune_v1")
        src2 = mk("ces_y.pdf", "cesiune_v2")
        ledger.add("copy_file", src1, f"{out_base}/Cesiune ALPHA.pdf", vin=vin)
        ledger.add("copy_file", src2, f"{out_base}/Supliment nr 2.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        names = sorted(Path(c.destination).name for c in ledger.changes if c.action == "copy_file")
        check("different cesiune numbered",
              names == ["ces_1.pdf", "ces_2.pdf"],
              f"got {names}")

        # --- Alte Documente: NOT renamed ---
        ledger = rs.Ledger()
        src = mk("other.pdf", "other_content")
        ledger.add("copy_file", src, f"{out_base}/random_document.pdf", vin=vin)
        stats, orig = rs.plan_category_renames(ledger)
        dst_name = Path(ledger.changes[0].destination).name
        check("Alte Documente not renamed", dst_name == "random_document.pdf")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

def test_planning_and_execution():
    print("\n=== Planning & Execution (full integration) ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "SIN_Changed"
        part_name = "SINDICALIZARE ALPHA FINAL - Part 1"
        build_full_test_tree(src)

        ledger = rs.Ledger()
        stats = rs.scan_and_plan(src, out, ledger, scan_pdf=False)

        check("found VIN-named", stats["vin_named"] >= 3)
        check("found multi-car", stats["multi_car"] >= 1)
        check("found flat", stats["flat"] >= 2)

        actions = set(c.action for c in ledger.changes)
        check("only copy/create actions", actions <= {"copy_file", "create_folder"},
              f"got: {actions}")

        # ── NO move, delete, rename, or remove_folder actions ──
        check("no move_file", "move_file" not in actions)
        check("no move_folder", "move_folder" not in actions)
        check("no remove_folder", "remove_folder" not in actions)
        check("no rename_folder", "rename_folder" not in actions)

        # Execute
        ledger.execute(dry_run=False, jsonl_path=out / "log.jsonl", workers=1)

        done = sum(1 for c in ledger.changes if c.status == "done")
        failed = sum(1 for c in ledger.changes if c.status == "failed")
        check("no failures", failed == 0, f"{failed} failed")
        check("ops completed", done > 0)

        op = out / "SINDICALIZARE ALPHA FINAL"

        # ── Source untouched ──
        check("source untouched",
              (src / part_name / "UU1DJF01873953007" /
               "FL - DACIA DUSTER, Alb - UU1DJF01873953007.pdf").exists())

        # ── Test 1: VIN folder copied ──
        check("VIN folder FL",
              (op / "UU1DJF01873953007" / "FL - DACIA DUSTER, Alb - UU1DJF01873953007.pdf").exists())
        check("VIN folder seriec",
              (op / "UU1DJF01873953007" / "seriec_UU1DJF01873953007_ctr cadru_Contract Cadru Leasing.pdf").exists())
        check("VIN folder RCA",
              (op / "UU1DJF01873953007" / "POLITA_RCA_28337197.pdf").exists())
        check("VIN folder OP",
              (op / "UU1DJF01873953007" / "OP SERVICE AUTO SRL 11.03.2025.PDF").exists())
        check("VIN folder Cesiune",
              (op / "UU1DJF01873953007" / "324. Cesiune ALPHA BANK 24.04.2025.pdf").exists())

        # ── Test 2: Nested VIN elevated ──
        check("nested VIN at partition level",
              (op / "XYZDE8765432109AB").is_dir())
        check("nested VIN has FL",
              (op / "XYZDE8765432109AB" / "FL - FORD FOCUS - XYZDE8765432109AB.pdf").exists())
        check("nested VIN NOT inside parent",
              not (op / "ABCDE2345678901AB" / "XYZDE8765432109AB").exists())
        check("parent VIN still has its file",
              (op / "ABCDE2345678901AB" / "seriec_ABCDE2345678901AB_doc.pdf").exists())

        # ── Test 3: contracte/ preserved under VIN ──
        check("contracte under VIN",
              (op / "JM4BP6HE60116024A" / "contracte" / "Contract Cadru Leasing.pdf").exists())
        check("contracte subcontract under VIN",
              (op / "JM4BP6HE60116024A" / "contracte" / "Subcontract Leasing nr1.pdf").exists())

        # ── Test 4: Multi-car dissolution ──
        check("multi VIN sub1 exists", (op / "FORD111111111111A").is_dir())
        check("multi VIN sub1 FL",
              (op / "FORD111111111111A" / "FL - FORD KUGA - FORD111111111111A.pdf").exists())
        check("multi VIN sub2 exists", (op / "FORD222222222222B").is_dir())
        # Loose files → parent VIN (which is FORD111111111111A based on get_parent_vin fallback)
        parent_vin = None
        for c in ledger.changes:
            if "parent VIN" in c.reason and "3 FORD KUGA" in c.parent_folder:
                parent_vin = Path(c.destination).parent.name
                break
        if parent_vin:
            check("multi loose file in parent VIN",
                  (op / parent_vin / "Contract Cadru Leasing_2CONNECT.pdf").exists())
            check("multi contracte in parent VIN",
                  (op / parent_vin / "contracte" / "Subcontract Leasing.pdf").exists())

        # ── Test 5: Flat single-VIN ──
        check("flat VIN folder created", (op / "DACIA12345678901A").is_dir())
        check("flat FL", (op / "DACIA12345678901A" / "FL - DACIA LOGAN - DACIA12345678901A.pdf").exists())
        check("flat seriec", (op / "DACIA12345678901A" / "seriec_DACIA12345678901A_Atasament.PDF").exists())
        check("flat RCA", (op / "DACIA12345678901A" / "POLITA_RCA_12345678.pdf").exists())

        # ── Test 6: Flat multi-VIN split ──
        check("split VIN1 exists", (op / "RENLT12345678901A").is_dir())
        check("split VIN2 exists", (op / "RNLT198765432109A").is_dir())
        check("split VIN2 supliment",
              (op / "RNLT198765432109A" / "RNLT198765432109A - Supliment Cesiune.pdf").exists())
        check("split VIN2 factura",
              (op / "RNLT198765432109A" / "Factura RNLT198765432109A.pdf").exists())

        # ── Test 7: Empty folder skipped ──
        check("empty not in output", not (op / "EMPTY FOLDER TEST").exists())

        # ── Test 8: VIN subdir inside flat elevated ──
        check("VIN subdir elevated", (op / "TOYOT12345678901A").is_dir())
        check("VIN subdir has seriec",
              (op / "TOYOT12345678901A" / "seriec_TOYOT12345678901A_extra.pdf").exists())

        # ── Test 9: Multi-car with no-VIN loose files (fallback) ──
        # Loose files should go to first VIN alphabetically (KMHHC811111111111)
        check("no-VIN multi: sub1 exists", (op / "KMHHC811111111111").is_dir())
        check("no-VIN multi: sub2 exists", (op / "KMHHC822222222222").is_dir())
        # "General info document.pdf" has no VIN → goes to parent (fallback = first subdir)
        fallback_parent = None
        for c in ledger.changes:
            if "4 HYUNDAI KONA" in c.parent_folder and "parent VIN" in c.reason:
                fallback_parent = Path(c.destination).parent.name
                break
        if fallback_parent:
            check("no-VIN loose in fallback parent",
                  (op / fallback_parent / "General info document.pdf").exists())
            check("no-VIN contracte in fallback parent",
                  (op / fallback_parent / "contracte" / "Master contract.pdf").exists())

        # ── Test 10: Output has ONLY VIN-named folders ──
        non_vin = [d.name for d in op.iterdir() if d.is_dir() and not rs.is_vin(d.name)]
        check("output only VIN folders", len(non_vin) == 0,
              f"non-VIN dirs: {non_vin}")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_v2_regression_contracte_duplication():
    """V2 bug: contracte/ files were copied to ALL VIN siblings, causing massive
    collision/skip operations. V3 should copy contracte/ only to parent VIN."""
    print("\n=== V2 Regression: Contracte Duplication ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        multi = part / "3 CARS - COMPANY SUBCT 1"
        for vin_name in ["VIN1234567890123A", "VIN1234567890123B", "VIN1234567890123C"]:
            make_pdf(multi / vin_name / f"FL - CAR - {vin_name}.pdf", f"fl_{vin_name}")
        make_pdf(multi / "contracte" / "Master Contract.pdf", "master")
        make_pdf(multi / "contracte" / "Sub Contract 1.pdf", "sub1")

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)

        # Count how many times each contracte file appears in plan
        contract_copies = Counter()
        for c in ledger.changes:
            if c.action == "copy_file" and "Master Contract" in c.destination:
                contract_copies["Master Contract"] += 1
            if c.action == "copy_file" and "Sub Contract" in c.destination:
                contract_copies["Sub Contract 1"] += 1

        check("Master Contract copied exactly 1 time",
              contract_copies["Master Contract"] == 1,
              f"copied {contract_copies['Master Contract']} times (v2 bug was N times)")
        check("Sub Contract copied exactly 1 time",
              contract_copies["Sub Contract 1"] == 1,
              f"copied {contract_copies['Sub Contract 1']} times")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_v2_regression_vin_nesting():
    """V2 bug: VIN subfolders ended up nested inside other VIN folders instead
    of elevated. E.g. partition/VIN_A/VIN_B instead of partition/VIN_B."""
    print("\n=== V2 Regression: VIN Nesting ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        # VIN folder with nested VIN subfolder
        vin_a = part / "AAAAAA12345678901"
        vin_b = vin_a / "BBBBBB98765432109"
        make_pdf(vin_a / "seriec_AAAAAA12345678901_doc.pdf", "a_doc")
        make_pdf(vin_b / "FL - CAR - BBBBBB98765432109.pdf", "b_fl")
        make_pdf(vin_b / "POLITA_RCA_111.pdf", "b_rca")

        # Flat folder with VIN subdir
        flat = part / "2 cars - company subct 1"
        make_pdf(flat / "FL - CAR - CCCCCC11111111111.pdf", "c_fl")
        vin_d = flat / "DDDDDD22222222222"
        make_pdf(vin_d / "seriec_DDDDDD22222222222_doc.pdf", "d_doc")

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)
        ledger.execute(dry_run=False, workers=1)

        op = out / "SINDICALIZARE ALPHA FINAL"

        # VIN_B must be at partition level, NOT inside VIN_A
        check("VIN_B at partition level", (op / "BBBBBB98765432109").is_dir())
        check("VIN_B NOT nested", not (op / "AAAAAA12345678901" / "BBBBBB98765432109").exists())
        check("VIN_B has its FL", (op / "BBBBBB98765432109" / "FL - CAR - BBBBBB98765432109.pdf").exists())
        check("VIN_A has its file", (op / "AAAAAA12345678901" / "seriec_AAAAAA12345678901_doc.pdf").exists())

        # VIN_D elevated from flat folder
        check("VIN_D at partition level", (op / "DDDDDD22222222222").is_dir())
        check("VIN_D NOT nested",
              not (op / "CCCCCC11111111111" / "DDDDDD22222222222").exists())

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_v2_regression_no_source_mutation():
    """V2 operated in-place (move/delete). V3 must NEVER modify source."""
    print("\n=== V2 Regression: Source Never Modified ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        flat = part / "2 dacia logan - company"
        make_pdf(flat / "FL - DACIA - DACIA12345678901A.pdf", "fl")
        make_pdf(flat / "seriec_DACIA12345678901A_doc.pdf", "seriec")
        make_pdf(flat / "POLITA_RCA_123.pdf", "rca")

        # Snapshot source file list
        before = set()
        for f in flat.rglob('*'):
            if f.is_file(): before.add(str(f.relative_to(src)))

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)
        ledger.execute(dry_run=False, workers=4)

        # Verify source unchanged
        after = set()
        for f in flat.rglob('*'):
            if f.is_file(): after.add(str(f.relative_to(src)))

        check("source files identical after execute", before == after,
              f"before: {len(before)}, after: {len(after)}")
        check("source folder still exists", flat.exists())

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_threading_safety():
    """Stress test: many concurrent copy operations to same output directory."""
    print("\n=== Threading Safety ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        # Create 50 VIN folders with 5 files each = 250 concurrent copies
        vins = []
        for i in range(50):
            vin = f"THRTEST{i:010d}"
            vins.append(vin)
            vin_dir = part / vin
            for j in range(5):
                make_pdf(vin_dir / f"file_{j}_{vin}.pdf", f"content_{i}_{j}")

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)

        copy_count = sum(1 for c in ledger.changes if c.action == "copy_file")
        check(f"planned {copy_count} copies (expected 250)", copy_count == 250)

        # Execute with 8 threads
        jsonl_path = out / "thread_log.jsonl"
        ledger.execute(dry_run=False, jsonl_path=jsonl_path, workers=8)

        done = sum(1 for c in ledger.changes if c.status == "done")
        failed = sum(1 for c in ledger.changes if c.status == "failed")
        check("all 250 copies done", done == 250, f"done={done}, failed={failed}")
        check("zero failures", failed == 0)

        # Verify all output files exist
        op = out / "SINDICALIZARE ALPHA FINAL"
        missing = 0
        for vin in vins:
            for j in range(5):
                f = op / vin / f"file_{j}_{vin}.pdf"
                if not f.exists():
                    missing += 1
        check("all output files exist", missing == 0, f"{missing} missing")

        # Verify JSONL log integrity (every line parseable)
        if jsonl_path.exists():
            lines = jsonl_path.read_text().strip().split('\n')
            parse_errors = 0
            for line in lines:
                try:
                    json.loads(line)
                except json.JSONDecodeError:
                    parse_errors += 1
            check("JSONL log all parseable", parse_errors == 0,
                  f"{parse_errors} parse errors in {len(lines)} lines")
            check("JSONL has all entries", len(lines) == len(ledger.changes),
                  f"{len(lines)} lines vs {len(ledger.changes)} changes")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_threading_collision_safety():
    """Multiple sources copying to files with same name in same VIN folder."""
    print("\n=== Threading: Collision Handling ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        # Two flat folders that both produce files for same VIN
        flat1 = part / "2 cars - company A"
        make_pdf(flat1 / "FL - CAR - COLLVIN1234567890.pdf", "content_A")
        make_pdf(flat1 / "seriec_COLLVIN1234567890_doc.pdf", "seriec_A")

        flat2 = part / "3 cars - company B"
        make_pdf(flat2 / "FL - CAR - COLLVIN1234567890.pdf", "content_B")  # DIFFERENT content
        make_pdf(flat2 / "seriec_COLLVIN1234567890_doc.pdf", "seriec_B")  # DIFFERENT

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)
        ledger.execute(dry_run=False, workers=1)  # sequential for deterministic collision

        failed = sum(1 for c in ledger.changes if c.status == "failed")
        check("no failures on collision", failed == 0)

        # Both files should exist (one renamed with _1 suffix)
        op = out / "SINDICALIZARE ALPHA FINAL" / "COLLVIN1234567890"
        pdfs = list(op.glob("FL*")) if op.exists() else []
        check("collision: both FL files exist", len(pdfs) == 2,
              f"found {len(pdfs)} FL files")

        seriecs = list(op.glob("seriec*")) if op.exists() else []
        check("collision: both seriec files exist", len(seriecs) == 2,
              f"found {len(seriecs)} seriec files")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_idempotency():
    """Running twice should skip all copies the second time."""
    print("\n=== Idempotency ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        build_full_test_tree(src)

        # First run
        l1 = rs.Ledger()
        rs.scan_and_plan(src, out, l1, scan_pdf=False)
        l1.execute(dry_run=False, workers=4)
        done1 = sum(1 for c in l1.changes if c.status == "done")

        # Second run
        l2 = rs.Ledger()
        rs.scan_and_plan(src, out, l2, scan_pdf=False)
        l2.execute(dry_run=False, workers=4)
        copy_done2 = sum(1 for c in l2.changes
                        if c.action == "copy_file" and c.status == "done")
        skipped2 = sum(1 for c in l2.changes
                      if c.action == "copy_file" and c.status == "skipped")

        check(f"second run: 0 new copies (got {copy_done2})", copy_done2 == 0)
        check(f"second run: all skipped ({skipped2})", skipped2 > 0)

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_excel_inventory():
    print("\n=== Excel Inventory ===")
    if not rs.HAS_OPENPYXL:
        print("  SKIP (openpyxl not installed)")
        return
    tmpdir = Path(tempfile.mkdtemp())
    try:
        excel = tmpdir / "inventory.xlsx"

        # First write
        inv1 = {
            "VIN1234567890123A": {
                "_partition": "Part 1",
                "_files": defaultdict(list, {
                    "Alte Documente": ["seriec_VIN_doc.pdf"],
                    "RCA": ["POLITA_RCA_123.pdf"],
                    "Formular de Livrare (FL)": ["FL - CAR - VIN.pdf"],
                    "Facturi": ["Factura car.pdf"],
                    "Cesiune / Supliment": ["324. Cesiune ALPHA.pdf"],
                }),
            },
        }
        rs.write_inventory_excel(excel, inv1)
        check("Excel created", excel.exists())

        # Read back
        wb = rs.load_workbook(str(excel))
        ws = wb.active
        headers = [c.value for c in ws[1]]
        check("has VIN column", headers[0] == "VIN")
        check("has Partition column", headers[1] == "Partition")
        check("has RCA column", "RCA" in headers)
        check("has Alte Documente column", "Alte Documente" in headers)
        check("has Total Files column", "Total Files" in headers)

        # Check data
        row2 = [c.value for c in ws[2]]
        check("row 1 VIN correct", row2[0] == "VIN1234567890123A")
        total_col = headers.index("Total Files")
        check("row 1 total = 5", row2[total_col] == 5, f"got {row2[total_col]}")
        wb.close()

        # Second write: fresh data, no merge with old
        inv2 = {
            "NEWVIN123456789AB": {
                "_partition": "Part 2",
                "_files": defaultdict(list, {
                    "Alte Documente": ["seriec_new.pdf"],
                    "OP Plăți": ["OP company.pdf"],
                }),
            },
        }
        rs.write_inventory_excel(excel, inv2)

        wb = rs.load_workbook(str(excel))
        ws = wb.active
        vins = set()
        for row in ws.iter_rows(min_row=2, max_col=1, values_only=True):
            if row[0]: vins.add(row[0])
        wb.close()
        check("fresh write: old VIN gone", "VIN1234567890123A" not in vins)
        check("fresh write: new VIN present", "NEWVIN123456789AB" in vins)
        check("fresh write: exactly 1 VIN", len(vins) == 1, f"got {len(vins)}")

        # Overwrite: write VIN with updated data
        inv3 = {
            "VIN1234567890123A": {
                "_partition": "Part 1",
                "_files": defaultdict(list, {
                    "Alte Documente": ["seriec_VIN_doc.pdf", "seriec_VIN_doc2.pdf"],
                    "RCA": ["POLITA_RCA_123.pdf"],
                }),
            },
        }
        rs.write_inventory_excel(excel, inv3)

        wb = rs.load_workbook(str(excel))
        ws = wb.active
        row2 = [c.value for c in ws[2]]
        headers = [c.value for c in ws[1]]
        total_col = headers.index("Total Files")
        # Only VIN1234567890123A in inv3, should be row 2
        check("update: VIN correct", row2[0] == "VIN1234567890123A")
        check("update: total files updated to 3", row2[total_col] == 3,
              f"got {row2[total_col]}")
        # NEWVIN should NOT be there (no merge)
        vins = set()
        for row in ws.iter_rows(min_row=2, max_col=1, values_only=True):
            if row[0]: vins.add(row[0])
        check("update: only 1 VIN (no merge)", len(vins) == 1, f"got {len(vins)}")
        wb.close()

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_large_scale_threading():
    """200 VIN folders, 4 files each, 8 threads — verify no data corruption."""
    print("\n=== Large-Scale Threading (800 files, 8 threads) ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        expected_files = {}  # vin -> {filename: content}
        for i in range(200):
            vin = f"LARGE{i:012d}"
            expected_files[vin] = {}
            vin_dir = part / vin
            for j, (prefix, content) in enumerate([
                ("FL - CAR - ", f"fl_{i}"),
                ("seriec_", f"seriec_{i}"),
                ("POLITA_RCA_", f"rca_{i}"),
                ("OP Company ", f"op_{i}"),
            ]):
                if prefix == "seriec_":
                    fn = f"seriec_{vin}_doc{j}.pdf"
                elif prefix.startswith("FL"):
                    fn = f"FL - CAR - {vin}.pdf"
                elif prefix.startswith("POLITA"):
                    fn = f"POLITA_RCA_{10000+i}.pdf"
                else:
                    fn = f"OP Company {10000+i}.pdf"
                make_pdf(vin_dir / fn, content)
                expected_files[vin][fn] = content

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)
        ledger.execute(dry_run=False, jsonl_path=out / "log.jsonl", workers=8)

        done = sum(1 for c in ledger.changes if c.status == "done")
        failed = sum(1 for c in ledger.changes if c.status == "failed")
        check(f"all 800 copies done (got {done})", done == 800)
        check("zero failures", failed == 0)

        # Verify file CONTENTS (detect corruption)
        op = out / "SINDICALIZARE ALPHA FINAL"
        corrupt = 0
        missing = 0
        for vin, files in expected_files.items():
            for fn, expected_content in files.items():
                fpath = op / vin / fn
                if not fpath.exists():
                    missing += 1
                    continue
                actual = fpath.read_bytes().decode()
                if actual != expected_content:
                    corrupt += 1

        check("zero missing files", missing == 0, f"{missing} missing")
        check("zero corrupted files", corrupt == 0, f"{corrupt} corrupted")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ═══════════════════════════════════════════════════════════════════════════

def test_pdf_cross_copy():
    """Test PDFs with content VINs get cross-copied to all matching VIN folders."""
    print("\n=== PDF Cross-Copy ===")
    tmpdir = Path(tempfile.mkdtemp())
    old_cache = dict(rs._pdf_cache)
    try:
        rs._pdf_cache.clear()
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        vin_a = "VINA1234567890123"
        vin_b = "VINB1234567890123"
        vin_c = "VINC1234567890123"

        # Three VIN folders
        make_pdf(part / vin_a / f"FL - CAR - {vin_a}.pdf", "fl_a")
        make_pdf(part / vin_a / "Cesiune ALPHA BANK.pdf", "cesiune_shared")
        make_pdf(part / vin_b / f"seriec_{vin_b}_doc.pdf", "seriec_b")
        make_pdf(part / vin_c / f"seriec_{vin_c}_doc.pdf", "seriec_c")

        # Simulate: Cesiune mentions vin_a and vin_b in text
        rs._pdf_cache[str(part / vin_a / "Cesiune ALPHA BANK.pdf")] = {vin_a, vin_b}

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)
        cross_stats = rs.plan_pdf_cross_copies(ledger, out)

        check("cross-copies planned", cross_stats["cross_copied"] >= 1,
              f"got {cross_stats['cross_copied']}")

        ledger.execute(dry_run=False, workers=1)
        op = out / "SINDICALIZARE ALPHA FINAL"

        check("cesiune in original VIN",
              (op / vin_a / "Cesiune ALPHA BANK.pdf").exists())
        check("cesiune cross-copied to VIN B",
              (op / vin_b / "Cesiune ALPHA BANK.pdf").exists())
        check("cesiune NOT in VIN C",
              not (op / vin_c / "Cesiune ALPHA BANK.pdf").exists())

        # Verify content integrity
        check("cross-copied content correct",
              (op / vin_b / "Cesiune ALPHA BANK.pdf").read_bytes() == b"cesiune_shared")

        # --- Test >100 VINs limit ---
        many_vin = "MANY1234567890123"
        make_pdf(part / many_vin / f"FL - CAR - {many_vin}.pdf", "fl_many")
        make_pdf(part / many_vin / "big_report.pdf", "report_content")
        big_vins = {f"BIG{i:03d}34567890123" for i in range(120)}
        rs._pdf_cache[str(part / many_vin / "big_report.pdf")] = big_vins

        ledger2 = rs.Ledger()
        rs.scan_and_plan(src, out, ledger2, scan_pdf=False)
        cross2 = rs.plan_pdf_cross_copies(ledger2, out)

        check(">100 VINs skipped", cross2["skipped_too_many"] >= 1,
              f"got {cross2['skipped_too_many']}")

        big_copies = [c for c in ledger2.changes
                      if c.action == "copy_file" and "big_report.pdf" in c.destination]
        check("big PDF only in its own folder", len(big_copies) == 1,
              f"found {len(big_copies)} copies")

    finally:
        rs._pdf_cache.clear()
        rs._pdf_cache.update(old_cache)
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_contract_gap_fill():
    """Test that VINs missing contracts get them filled from high-VIN-count PDFs,
    using both filename patterns AND PDF text content categories."""
    print("\n=== Contract Gap-Fill ===")
    tmpdir = Path(tempfile.mkdtemp())
    old_cache = dict(rs._pdf_cache)
    old_cats = dict(rs._pdf_content_cats)
    try:
        rs._pdf_cache.clear()
        rs._pdf_content_cats.clear()
        src = tmpdir / "SIN"
        out = tmpdir / "OUT"
        part = src / "SINDICALIZARE ALPHA FINAL - Part 1"

        vin_a = "GAPA1234567890123"
        vin_b = "GAPB1234567890123"
        vin_c = "GAPC1234567890123"
        vin_d = "GAPD1234567890123"

        # VIN A has a contract (filename-identifiable) + seriec
        make_pdf(part / vin_a / f"seriec_{vin_a}_doc.pdf", "seriec_a")
        make_pdf(part / vin_a / "Contract Cadru Leasing Operational.pdf", "ctr_a")

        # VIN B has only seriec - NO contract
        make_pdf(part / vin_b / f"seriec_{vin_b}_doc.pdf", "seriec_b")

        # VIN C has only seriec - NO contract
        make_pdf(part / vin_c / f"seriec_{vin_c}_doc.pdf", "seriec_c")

        # VIN D has only a generic-named PDF - NO contract, NO RCA
        make_pdf(part / vin_d / f"seriec_{vin_d}_doc.pdf", "seriec_d")
        # VIN D also has a generic-named PDF whose content is a contract+RCA
        make_pdf(part / vin_d / "document_scan_001.pdf", "generic_doc")

        # Contract PDF in VIN A: mentions all VINs (>100 total → skipped by cross-copy)
        big_vins = {vin_a, vin_b, vin_c, vin_d}
        big_vins |= {f"XTRA{i:013d}" for i in range(107)}
        ctr_path = str(part / vin_a / "Contract Cadru Leasing Operational.pdf")
        rs._pdf_cache[ctr_path] = big_vins
        rs._pdf_content_cats[ctr_path] = {"Contract Cadru"}

        # Generic PDF in VIN D: filename says nothing, but content has contract+RCA keywords
        # Also >100 VINs so it skips normal cross-copy too
        big_vins2 = {vin_b, vin_c, vin_d}
        big_vins2 |= {f"YTRA{i:013d}" for i in range(110)}
        generic_path = str(part / vin_d / "document_scan_001.pdf")
        rs._pdf_cache[generic_path] = big_vins2
        rs._pdf_content_cats[generic_path] = {"Contract Cadru", "RCA"}

        # Plan + cross-copy
        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)
        cross = rs.plan_pdf_cross_copies(ledger, out)
        check("contract skipped by cross-copy (>100 VINs)",
              cross["skipped_too_many"] >= 1)

        # Gap-fill: should use BOTH filename-based (Contract Cadru.pdf) and
        # content-based (document_scan_001.pdf contains contract keywords)
        gap = rs.plan_contract_gap_fill(ledger, out)
        check("gap-fill found VINs with gaps", gap["vins_with_gaps"] >= 2,
              f"got {gap['vins_with_gaps']}")
        check("gap-fill created copies", gap["gap_filled"] >= 2,
              f"got {gap['gap_filled']}")

        # Execute and verify
        ledger.execute(dry_run=False, workers=1)
        op = out / "SINDICALIZARE ALPHA FINAL"

        check("VIN A has contract (original)",
              (op / vin_a / "Contract Cadru Leasing Operational.pdf").exists())
        check("VIN B got contract (gap-filled)",
              (op / vin_b / "Contract Cadru Leasing Operational.pdf").exists() or
              (op / vin_b / "document_scan_001.pdf").exists())
        check("VIN C got contract (gap-filled)",
              (op / vin_c / "Contract Cadru Leasing Operational.pdf").exists() or
              (op / vin_c / "document_scan_001.pdf").exists())

        # Content-based: document_scan_001.pdf detected as RCA by content,
        # should fill RCA gap for VINs it mentions
        gap_changes = [c for c in ledger.changes
                       if c.reason and "Gap-fill" in c.reason]
        content_fills = [c for c in gap_changes if "document_scan_001" in c.source]
        check("content-based gap-fill happened", len(content_fills) >= 1,
              f"got {len(content_fills)} content-based fills")

    finally:
        rs._pdf_cache.clear()
        rs._pdf_content_cats.clear()
        rs._pdf_cache.update(old_cache)
        rs._pdf_content_cats.update(old_cats)
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_reclassify_by_content():
    print("\n=== Content-Based Reclassification ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        # Build a fake output directory structure
        part_name = "SINDICALIZARE ALPHA FINAL - Part 1"
        vin_a = "VINA1234567890123"
        vin_b = "VINB1234567890123"
        vin_c = "VINC1234567890123"

        # VIN A: has Contract Cadru by filename, missing CASCO/RCA
        #   + an Alte Doc PDF that is actually a CASCO document
        dir_a = tmpdir / part_name / vin_a
        dir_a.mkdir(parents=True)
        make_pdf(dir_a / "Contract Cadru Leasing.pdf", "contract")
        make_pdf(dir_a / "seriec_VINA1234567890123_doc1.pdf", "generic1")
        make_pdf(dir_a / "scan_001.pdf", "generic2")

        # VIN B: missing Contract Cadru
        #   + an Alte Doc PDF that is actually a contract
        dir_b = tmpdir / part_name / vin_b
        dir_b.mkdir(parents=True)
        make_pdf(dir_b / "FL - CAR - VINB1234567890123.pdf", "fl_b")
        make_pdf(dir_b / "seriec_VINB1234567890123_document.pdf", "generic3")

        # VIN C: has everything, no gaps → should NOT be scanned at all
        dir_c = tmpdir / part_name / vin_c
        dir_c.mkdir(parents=True)
        make_pdf(dir_c / "Contract Cadru Leasing.pdf", "ctr")
        make_pdf(dir_c / "Subcontract Leasing.pdf", "sub")
        make_pdf(dir_c / "FlexiCasco policy.pdf", "casco")
        make_pdf(dir_c / "POLITA_RCA_12345.pdf", "rca")
        make_pdf(dir_c / "TALON_B 925 BMG.pdf", "talon")
        make_pdf(dir_c / "Factura Toyota.pdf", "factura")
        make_pdf(dir_c / "random_thing.pdf", "other")

        # Build inventory (filename-based)
        inv = rs.build_inventory(tmpdir)

        # Verify initial categorization
        check("VIN A has Contract Cadru", bool(inv[vin_a]["_files"].get("Contract Cadru")))
        check("VIN A: 2 in Alte Documente",
              len(inv[vin_a]["_files"].get("Alte Documente", [])) == 2,
              f"got {inv[vin_a]['_files'].get('Alte Documente', [])}")
        check("VIN B: seriec in Alte Documente",
              len(inv[vin_b]["_files"].get("Alte Documente", [])) == 1)

        # Inject reclassification cache (simulating PDF content detection)
        rs._reclass_cache.clear()
        # VIN A: scan_001.pdf contains CASCO keywords
        rs._reclass_cache[str(dir_a / "scan_001.pdf")] = "CASCO"
        # VIN A: seriec doc is just generic, no match
        rs._reclass_cache[str(dir_a / "seriec_VINA1234567890123_doc1.pdf")] = None
        # VIN B: seriec doc is actually a Contract Cadru
        rs._reclass_cache[str(dir_b / "seriec_VINB1234567890123_document.pdf")] = "Contract Cadru"

        # Run reclassification
        stats = rs.reclassify_by_content(inv, tmpdir, workers=1)

        check("scanned PDFs > 0", stats["scanned"] > 0, f"got {stats['scanned']}")
        check("reclassified > 0", stats["reclassified"] >= 2, f"got {stats['reclassified']}")

        # VIN A: scan_001.pdf should move from Alte Documente → CASCO
        check("VIN A: CASCO now present", bool(inv[vin_a]["_files"].get("CASCO")),
              f"got {dict(inv[vin_a]['_files'])}")
        check("VIN A: scan_001.pdf in CASCO",
              "scan_001.pdf" in inv[vin_a]["_files"]["CASCO"])
        check("VIN A: scan_001.pdf NOT in Alte Documente",
              "scan_001.pdf" not in inv[vin_a]["_files"].get("Alte Documente", []))
        # Generic seriec stays in Alte Documente
        check("VIN A: seriec still in Alte Documente",
              any("seriec" in f for f in inv[vin_a]["_files"].get("Alte Documente", [])))

        # VIN B: seriec doc should move from Alte Documente → Contract Cadru
        check("VIN B: Contract Cadru now present",
              bool(inv[vin_b]["_files"].get("Contract Cadru")),
              f"got {dict(inv[vin_b]['_files'])}")
        check("VIN B: Alte Documente empty",
              len(inv[vin_b]["_files"].get("Alte Documente", [])) == 0)

        # VIN C: should not have been touched (no gaps)
        check("VIN C: Alte Documente unchanged",
              len(inv[vin_c]["_files"].get("Alte Documente", [])) == 1)

        rs._reclass_cache.clear()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_folder_name_vin_and_no_vin():
    print("\n=== Folder-Name VIN Extraction & _NO_VIN Fallback ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "src" / "SINDICALIZARE TEST - Part 1"
        out = tmpdir / "out"
        src.mkdir(parents=True)
        out.mkdir()

        # --- Type A: VIN in folder name, no VINs in filenames ---
        vin_folder = src / "JTEBR3FJ20K323532 - TOYOTA LANDRUISER - PAINEA DE CASA"
        vin_folder.mkdir()
        make_pdf(vin_folder / "contract.pdf", "some content")
        make_pdf(vin_folder / "document.pdf", "more content")

        out_part = out / "SINDICALIZARE TEST"
        ledger = rs.Ledger()
        rs.plan_flat(vin_folder, out_part, ledger, scan_pdf=False)
        copies = [c for c in ledger.changes if c.action == "copy_file"]
        check("folder-name VIN: files copied", len(copies) == 2, f"got {len(copies)}")
        # Should copy to VIN folder extracted from folder name
        vins_used = {c.vin for c in copies}
        check("folder-name VIN: uses JTEBR3FJ20K323532",
              "JTEBR3FJ20K323532" in vins_used, f"got {vins_used}")
        dests = {Path(c.destination).parent.name for c in copies}
        check("folder-name VIN: dest is VIN dir",
              "JTEBR3FJ20K323532" in dests, f"got {dests}")

        # --- Type A: VIN in folder name, 0 files (but has subdir) ---
        vin_folder2 = src / "JN1T33TB5U0011992 - NISSAN X TRAIL - ISO PLUS"
        vin_folder2.mkdir()
        sub = vin_folder2 / "docs"
        sub.mkdir()
        make_pdf(sub / "inner.pdf", "sub content")

        ledger = rs.Ledger()
        rs.plan_flat(vin_folder2, out_part, ledger, scan_pdf=False)
        copies = [c for c in ledger.changes if c.action == "copy_file"]
        check("folder-name VIN with subdir: files copied", len(copies) == 1,
              f"got {len(copies)}")
        check("folder-name VIN with subdir: uses correct VIN",
              copies[0].vin == "JN1T33TB5U0011992", f"got {copies[0].vin}")

        # --- Type B: truly no VINs anywhere, has files → _NO_VIN ---
        no_vin_folder = src / "3 DACIA SANDERO - NEGRES GRUP SRL subct 1"
        no_vin_folder.mkdir()
        make_pdf(no_vin_folder / "factura.pdf", "no vin content")
        make_pdf(no_vin_folder / "doc.pdf", "also no vin")

        ledger = rs.Ledger()
        rs.plan_flat(no_vin_folder, out_part, ledger, scan_pdf=False)
        copies = [c for c in ledger.changes if c.action == "copy_file"]
        check("no-VIN: files copied to _NO_VIN", len(copies) == 2,
              f"got {len(copies)}")
        check("no-VIN: vin field is _NO_VIN", all(c.vin == "_NO_VIN" for c in copies))
        dests = [Path(c.destination) for c in copies]
        check("no-VIN: dest contains _NO_VIN",
              all("_NO_VIN" in str(d) for d in dests), f"got {dests}")
        check("no-VIN: preserves folder name in path",
              all("3 DACIA SANDERO" in str(d) for d in dests), f"got {dests}")

        # --- Type B: truly no VINs, empty folder → just warns ---
        empty_folder = src / "2x IVECO DAILY - DAW BENTA ROMANIA SRL"
        empty_folder.mkdir()

        ledger = rs.Ledger()
        rs.plan_flat(empty_folder, out_part, ledger, scan_pdf=False)
        copies = [c for c in ledger.changes if c.action == "copy_file"]
        check("empty no-VIN: no copies", len(copies) == 0)
        check("empty no-VIN: has warning", len(ledger.warnings) == 1)
        check("empty no-VIN: warns empty",
              "empty folder" in ledger.warnings[0], f"got: {ledger.warnings[0]}")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_rescan_rescue_no_vin():
    print("\n=== Rescan: Rescue _NO_VIN Folders ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        # Simulate existing output with _NO_VIN folders
        out = tmpdir / "out"
        part = out / "SINDICALIZARE TEST"
        no_vin = part / "_NO_VIN"

        # Case 1: folder name contains a VIN (fallback extraction)
        folder1 = no_vin / "JTEBR3FJ20K323532 - TOYOTA LANDRUISER - PAINEA DE CASA"
        folder1.mkdir(parents=True)
        make_pdf(folder1 / "contract.pdf", "some content A")
        make_pdf(folder1 / "factura.pdf", "some content B")

        # Case 2: folder name has no VIN → stays in _NO_VIN
        folder2 = no_vin / "3 DACIA SANDERO - NEGRES GRUP SRL"
        folder2.mkdir(parents=True)
        make_pdf(folder2 / "doc.pdf", "no vin here")

        stats = rs.rescan_rescue_no_vin(out, workers=1, ocr=False)

        # Folder 1 should have been rescued (VIN in folder name)
        vin_dir = part / "JTEBR3FJ20K323532"
        check("rescue: VIN folder created", vin_dir.exists())
        check("rescue: contract.pdf moved", (vin_dir / "contract.pdf").exists())
        # factura.pdf → categorized as Facturi → renamed to fact.pdf
        check("rescue: factura.pdf moved as fact.pdf", (vin_dir / "fact.pdf").exists())
        check("rescue: original folder removed", not folder1.exists())
        check("rescue: moved files count", stats["moved"] >= 2, f"got {stats['moved']}")

        # Folder 2 should still be in _NO_VIN
        check("rescue: no-VIN folder stays", folder2.exists())
        check("rescue: doc.pdf still there", (folder2 / "doc.pdf").exists())

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_rescan_apply_renames():
    print("\n=== Rescan: Apply Renames on Disk ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        out = tmpdir / "out"
        part = out / "SINDICALIZARE TEST"
        vin_dir = part / "AAABB12345CCC6789"
        vin_dir.mkdir(parents=True)

        # Files with original long names (not yet renamed)
        make_pdf(vin_dir / "Contract cadru AAABB12345CCC6789.pdf", "contract A")
        make_pdf(vin_dir / "FL - Toyota Rav4 - AAABB12345CCC6789.pdf", "fl content")
        # Duplicate casco files (should dedup)
        make_pdf(vin_dir / "FLEXICASCO_12345.pdf", "casco content")
        make_pdf(vin_dir / "CASCO_COPY.pdf", "casco content")  # same content
        # Different op files (should number)
        make_pdf(vin_dir / "OP 12345.pdf", "op one")
        make_pdf(vin_dir / "OP 67890.pdf", "op two")

        stats, orig_names = rs.rescan_apply_renames(out)

        files = {f.name for f in vin_dir.iterdir()}
        check("rename: cc.pdf exists", "cc.pdf" in files, f"got {files}")
        check("rename: fl.pdf exists", "fl.pdf" in files, f"got {files}")
        check("rename: casco.pdf exists (deduped)", "casco.pdf" in files, f"got {files}")
        # Should NOT have two casco files since they're identical
        casco_files = [f for f in files if f.startswith("casco")]
        check("rename: one casco file (deduped)", len(casco_files) == 1,
              f"got {casco_files}")
        # OP files should be numbered
        op_files = sorted(f for f in files if f.startswith("op"))
        check("rename: op files numbered", len(op_files) == 2,
              f"got {op_files}")
        check("rename: stats renamed > 0", stats["renamed"] > 0, f"got {stats}")
        check("rename: stats deduped > 0", stats["deduped"] > 0, f"got {stats}")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_rescan_reclassify_rename_on_disk():
    print("\n=== Rescan: Reclassify + Rename on Disk ===")
    tmpdir = Path(tempfile.mkdtemp())
    try:
        out = tmpdir / "out"
        part = out / "SINDICALIZARE TEST"
        vin = "AAABB12345CCC6789"
        vin_dir = part / vin
        vin_dir.mkdir(parents=True)

        # File categorized as "Alte Documente" but actually CASCO
        make_pdf(vin_dir / "random_name_123.pdf", "CASCO content")
        make_pdf(vin_dir / "cc.pdf", "contract")  # already has contract

        # Inject into reclass cache to simulate content detection
        abs_path = str(vin_dir / "random_name_123.pdf")
        rs._reclass_cache[abs_path] = "CASCO"

        # Build inventory
        inventory = rs.build_inventory(out)

        # Verify file is currently in Alte Documente
        files_before = inventory[vin]["_files"]
        check("reclass-disk: file in Alte Documente before",
              "random_name_123.pdf" in files_before.get("Alte Documente", []),
              f"got {files_before}")

        # Reclassify WITH rename_on_disk
        reclass_stats = rs.reclassify_by_content(
            inventory, out, workers=1, rename_on_disk=True)

        check("reclass-disk: reclassified count", reclass_stats["reclassified"] == 1,
              f"got {reclass_stats}")

        # File should be renamed on disk
        disk_files = {f.name for f in vin_dir.iterdir()}
        check("reclass-disk: casco.pdf exists on disk", "casco.pdf" in disk_files,
              f"got {disk_files}")
        check("reclass-disk: old file gone", "random_name_123.pdf" not in disk_files,
              f"got {disk_files}")

        # Inventory should reflect the change
        files_after = inventory[vin]["_files"]
        check("reclass-disk: CASCO has casco.pdf",
              "casco.pdf" in files_after.get("CASCO", []),
              f"got {files_after}")

        rs._reclass_cache.clear()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_partition_merging():
    print("\n=== Partition Merging ===")
    # Unit test: merge_partition_name
    check("strip Part 1", rs.merge_partition_name("SINDICALIZARE FOO - Part 1") == "SINDICALIZARE FOO")
    check("strip Part 2", rs.merge_partition_name("SINDICALIZARE FOO - Part 2") == "SINDICALIZARE FOO")
    check("strip Part 10", rs.merge_partition_name("SINDICALIZARE FOO - Part 10") == "SINDICALIZARE FOO")
    check("strip part (lowercase)", rs.merge_partition_name("SINDICALIZARE FOO - part 3") == "SINDICALIZARE FOO")
    check("no Part suffix unchanged",
          rs.merge_partition_name("SINDICALIZARE SINGLE") == "SINDICALIZARE SINGLE")

    # Integration: two partitions merge into one output directory
    tmpdir = Path(tempfile.mkdtemp())
    try:
        src = tmpdir / "SIN"
        out = tmpdir / "SIN_Changed"

        vin_a = "AAAAAA12345678901"
        vin_b = "BBBBBB98765432109"

        # Source: two partitions
        part1 = src / "SINDICALIZARE TEST - Part 1"
        part2 = src / "SINDICALIZARE TEST - Part 2"

        (part1 / vin_a).mkdir(parents=True)
        make_pdf(part1 / vin_a / f"FL - DACIA - {vin_a}.pdf", "fl_a")

        (part2 / vin_b).mkdir(parents=True)
        make_pdf(part2 / vin_b / f"FL - TOYOTA - {vin_b}.pdf", "fl_b")

        ledger = rs.Ledger()
        rs.scan_and_plan(src, out, ledger, scan_pdf=False)
        ledger.execute(dry_run=False, workers=1)

        merged = out / "SINDICALIZARE TEST"
        check("merged dir exists", merged.exists())
        check("Part 1 dir NOT created", not (out / "SINDICALIZARE TEST - Part 1").exists())
        check("Part 2 dir NOT created", not (out / "SINDICALIZARE TEST - Part 2").exists())
        check("VIN A in merged", (merged / vin_a).exists())
        check("VIN B in merged", (merged / vin_b).exists())

        # Inventory: partition column shows merged name
        inv = rs.build_inventory(out)
        check("VIN A partition merged", inv[vin_a]["_partition"] == "SINDICALIZARE TEST")
        check("VIN B partition merged", inv[vin_b]["_partition"] == "SINDICALIZARE TEST")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_rename_map_persistence():
    """Test that rename_map.json saves/loads correctly."""
    print("\n=== Rename Map Persistence ===")
    tmpdir = tempfile.mkdtemp()
    try:
        output_root = Path(tmpdir)

        # Save a rename map
        original_names = {
            ("WBAXX12345Y678901", "cc.pdf"): "CONTRACT_CADRU_VERY_LONG_NAME.pdf",
            ("WBAXX12345Y678901", "rca.pdf"): "RCA_ASIG_2024.pdf",
            ("SALGA2BN7LA123456", "fact.pdf"): "FACTURA_123.pdf",
        }
        rs.save_rename_map(output_root, original_names)
        check("rename map file created",
              (output_root / "rename_map.json").exists())

        # Load it back
        loaded = rs.load_rename_map(output_root)
        check("rename map round-trip count", len(loaded) == 3)
        check("rename map round-trip value",
              loaded.get(("WBAXX12345Y678901", "cc.pdf"))
              == "CONTRACT_CADRU_VERY_LONG_NAME.pdf")
        check("rename map round-trip vin2",
              loaded.get(("SALGA2BN7LA123456", "fact.pdf"))
              == "FACTURA_123.pdf")

        # Save more entries → merges with existing
        more = {("WBAXX12345Y678901", "op.pdf"): "OP_PLATA_NEW.pdf"}
        rs.save_rename_map(output_root, more)
        loaded2 = rs.load_rename_map(output_root)
        check("rename map merge count", len(loaded2) == 4)
        check("rename map merge preserves old",
              loaded2.get(("WBAXX12345Y678901", "rca.pdf"))
              == "RCA_ASIG_2024.pdf")
        check("rename map merge has new",
              loaded2.get(("WBAXX12345Y678901", "op.pdf"))
              == "OP_PLATA_NEW.pdf")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_short_name_categorization():
    """Test that categorize_file recognizes all short names back."""
    print("\n=== Short Name Categorization ===")
    # All short names must map back to their category
    expected = {
        "cc.pdf": "Contract Cadru",
        "cc_1.pdf": "Contract Cadru",
        "cc_23.pdf": "Contract Cadru",
        "subct.pdf": "Subcontract",
        "subct_2.pdf": "Subcontract",
        "fl.pdf": "Formular de Livrare (FL)",
        "casco.pdf": "CASCO",
        "casco_3.pdf": "CASCO",
        "rca.pdf": "RCA",
        "rca_1.pdf": "RCA",
        "op.pdf": "OP Plăți",
        "op_14.pdf": "OP Plăți",
        "fact.pdf": "Facturi",
        "fact_2.pdf": "Facturi",
        "ces.pdf": "Cesiune / Supliment",
        "ces_2.pdf": "Cesiune / Supliment",
        "talon.pdf": "TALON / CIV",
        "civ.pdf": "TALON / CIV",
        "TALON+CIV.pdf": "TALON / CIV",
        "talon_civ.pdf": "TALON / CIV",
    }
    for fn, expected_cat in expected.items():
        got = rs.categorize_file(fn)
        check(f"short name {fn} → {expected_cat}", got == expected_cat,
              f"got {got}")

    # build_inventory should use actual filename for categorization
    tmpdir = tempfile.mkdtemp()
    try:
        output_root = Path(tmpdir)
        vin = "WBAXX12345Y678901"
        part_dir = output_root / "SINDICALIZARE TEST Part 1"
        vin_dir = part_dir / vin
        vin_dir.mkdir(parents=True)
        (vin_dir / "cc.pdf").write_text("contract")
        (vin_dir / "rca.pdf").write_text("rca doc")
        (vin_dir / "op.pdf").write_text("payment")

        # Without original_names: files categorized by short name
        inv = rs.build_inventory(output_root)
        files = inv[vin]["_files"]
        check("cc.pdf in Contract Cadru",
              any("cc.pdf" in f for f in files.get("Contract Cadru", [])))
        check("rca.pdf in RCA",
              any("rca.pdf" in f for f in files.get("RCA", [])))
        check("op.pdf in OP",
              any("op.pdf" in f for f in files.get("OP Plăți", [])))
        check("nothing in Alte Documente",
              len(files.get("Alte Documente", [])) == 0)

        # With original_names: categorized by actual, displayed as original
        orig_names = {
            (vin, "cc.pdf"): "CONTRACT_CADRU_LONG.pdf",
            (vin, "rca.pdf"): "RCA_ASIGURARE.pdf",
        }
        inv2 = rs.build_inventory(output_root, original_names=orig_names)
        files2 = inv2[vin]["_files"]
        check("cc.pdf still in Contract Cadru with orig names",
              any("CONTRACT_CADRU_LONG.pdf" in f
                  for f in files2.get("Contract Cadru", [])))
        check("rca.pdf still in RCA with orig names",
              any("RCA_ASIGURARE.pdf" in f
                  for f in files2.get("RCA", [])))
        check("op.pdf in OP (no orig name → shows short name)",
              any("op.pdf" in f for f in files2.get("OP Plăți", [])))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_ledger_based_inventory():
    """Test build_inventory_from_ledger builds correct inventory from planned changes."""
    print("\n=== Ledger-Based Inventory ===")

    # Also test OCR boost/restore
    old_dpi = rs._OCR_DPI
    old_pages = rs._OCR_MAX_PAGES
    old_config = rs._OCR_TESS_CONFIG
    rs._ocr_boost_rescue()
    check("ocr boost: DPI raised", rs._OCR_DPI == rs._OCR_RESCUE_DPI)
    check("ocr boost: max pages raised", rs._OCR_MAX_PAGES == rs._OCR_RESCUE_MAX_PAGES)
    check("ocr boost: config changed", rs._OCR_TESS_CONFIG == rs._OCR_RESCUE_TESS_CONFIG)
    rs._ocr_restore()
    check("ocr restore: DPI", rs._OCR_DPI == old_dpi)
    check("ocr restore: max pages", rs._OCR_MAX_PAGES == old_pages)
    check("ocr restore: config", rs._OCR_TESS_CONFIG == old_config)
    tmpdir = Path(tempfile.mkdtemp())
    try:
        out = tmpdir / "OUT"
        part = out / "SINDICALIZARE TEST FINAL"
        vin1_dir = part / "WVWZZZ3CZWE000001"
        vin2_dir = part / "WVWZZZ3CZWE000002"

        # Create actual output files
        for d in [vin1_dir / "contracte", vin2_dir]:
            os.makedirs(str(d), exist_ok=True)

        (vin1_dir / "contracte" / "cc.pdf").write_bytes(b"contract")
        (vin1_dir / "fl.pdf").write_bytes(b"fl data")
        (vin1_dir / "some_random.pdf").write_bytes(b"other")
        (vin2_dir / "rca.pdf").write_bytes(b"rca data")

        # Build a ledger simulating scan_and_plan
        ledger = rs.Ledger()
        ledger.add("copy_file",
                    str(tmpdir / "SRC" / "orig_contract.pdf"),
                    str(vin1_dir / "contracte" / "cc.pdf"),
                    vin="WVWZZZ3CZWE000001")
        ledger.add("copy_file",
                    str(tmpdir / "SRC" / "FL - CAR.pdf"),
                    str(vin1_dir / "fl.pdf"),
                    vin="WVWZZZ3CZWE000001")
        ledger.add("copy_file",
                    str(tmpdir / "SRC" / "random_doc.pdf"),
                    str(vin1_dir / "some_random.pdf"),
                    vin="WVWZZZ3CZWE000001")
        ledger.add("copy_file",
                    str(tmpdir / "SRC" / "polita_rca.pdf"),
                    str(vin2_dir / "rca.pdf"),
                    vin="WVWZZZ3CZWE000002")
        # File that doesn't exist (wasn't copied)
        ledger.add("copy_file",
                    str(tmpdir / "SRC" / "missing.pdf"),
                    str(vin2_dir / "op.pdf"),
                    vin="WVWZZZ3CZWE000002")

        orig_names = {
            ("WVWZZZ3CZWE000001", "cc.pdf"): "CONTRACT_CADRU_ALPHA.pdf",
            ("WVWZZZ3CZWE000001", "fl.pdf"): "FL - CAR - WVWZZZ3CZWE000001.pdf",
        }
        inv = rs.build_inventory_from_ledger(ledger, out, original_names=orig_names)

        check("ledger inv: 2 VINs", len(inv) == 2, f"got {len(inv)}")
        check("ledger inv: VIN1 present", "WVWZZZ3CZWE000001" in inv)
        check("ledger inv: VIN2 present", "WVWZZZ3CZWE000002" in inv)

        files1 = inv["WVWZZZ3CZWE000001"]["_files"]
        cc_files = files1.get("Contract Cadru", [])
        check("ledger inv: cc in Contract Cadru", len(cc_files) == 1, f"got {cc_files}")
        check("ledger inv: cc shows original name",
              any("CONTRACT_CADRU_ALPHA.pdf" in f for f in cc_files), f"got {cc_files}")
        fl_files = files1.get("Formular de Livrare (FL)", [])
        check("ledger inv: fl present", len(fl_files) == 1, f"got {fl_files}")

        files2 = inv["WVWZZZ3CZWE000002"]["_files"]
        check("ledger inv: rca in RCA", len(files2.get("RCA", [])) == 1)
        # op.pdf is in ledger even though file doesn't exist on disk
        # (ledger is purely from planning, no disk checks)
        check("ledger inv: planned op included", len(files2.get("OP Plăți", [])) == 1)

        check("ledger inv: partition",
              inv["WVWZZZ3CZWE000001"]["_partition"] == "SINDICALIZARE TEST FINAL")

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def test_content_category_dominance():
    """Test that first-position-in-text wins over count or fixed priority."""
    print("\n=== Content Category: First Position Wins ===")

    # Contract Cadru appears first, even though "factura" appears more times
    text1 = "CONTRACT CADRU nr. 12345\nClauze contractuale\nFactura atasata\nFactura nr 1\nFactura nr 2"
    result1 = rs._best_content_category(text1)
    check("contract first despite 3x factura later", result1 == "Contract Cadru")

    # Factura appears first → should win even if contract appears later
    text2 = "FACTURA FISCALA nr 999\nDetalii factura\nContract Cadru referinta"
    result2 = rs._best_content_category(text2)
    check("factura first wins over contract later", result2 == "Facturi")

    # Subcontract first, CASCO mentioned many times later
    text3 = "SUBCONTRACT nr 55\nTermeni\nCASCO polita\nCASCO plata\nCASCO acoperire\nCASCO detalii"
    result3 = rs._best_content_category(text3)
    check("subcontract first despite 4x casco later", result3 == "Subcontract")

    # CASCO first
    text4 = "POLITA CASCO nr 123\nDetalii\nContract Cadru mentionat\nSubcontract referinta"
    result4 = rs._best_content_category(text4)
    check("casco first wins over contract+subcontract", result4 == "CASCO")

    # RCA first
    text5 = "POLITA RCA auto\nRaspundere Civila\nFactura atasata\nContract Cadru ref"
    result5 = rs._best_content_category(text5)
    check("rca first wins over factura+contract", result5 == "RCA")

    # TALON first
    text6 = "TALON auto vehicul\nDetalii\nCASCO polita\nRCA polita\nFactura"
    result6 = rs._best_content_category(text6)
    check("talon first wins over casco+rca+factura", result6 == "TALON / CIV")

    # CIV first
    text7 = "Certificat de Inmatriculare vehicul\nContract Cadru\nSubcontract"
    result7 = rs._best_content_category(text7)
    check("CIV first wins over contract+subcontract", result7 == "TALON / CIV")

    # Single category only
    text8 = "Detalii diverse\nCASCO polita de asigurare"
    result8 = rs._best_content_category(text8)
    check("single category match", result8 == "CASCO")

    # No match at all
    text9 = "Lorem ipsum dolor sit amet"
    result9 = rs._best_content_category(text9)
    check("no match returns None", result9 is None)

    # Empty text
    result10 = rs._best_content_category("")
    check("empty text returns None", result10 is None)


def test_content_first_position_wins():
    """Exhaustive pairwise test: for every pair of categories, verify
    that whichever appears first in the text is the one selected."""
    print("\n=== Content Category: Pairwise First-Position ===")

    # Representative keyword for each category
    cat_keywords = {
        "Contract Cadru": "Contract Cadru",
        "Subcontract": "Subcontract",
        "CASCO": "CASCO",
        "RCA": "RCA",
        "TALON / CIV": "TALON",
        "Facturi": "FACTURA",
    }

    cats = list(cat_keywords.keys())
    for i, cat_a in enumerate(cats):
        for cat_b in cats[i+1:]:
            kw_a = cat_keywords[cat_a]
            kw_b = cat_keywords[cat_b]

            # cat_a first
            text_a_first = f"{kw_a} document\nAlte detalii\n{kw_b} referinta"
            result = rs._best_content_category(text_a_first)
            check(f"{cat_a} before {cat_b} → {cat_a}", result == cat_a)

            # cat_b first
            text_b_first = f"{kw_b} document\nAlte detalii\n{kw_a} referinta"
            result = rs._best_content_category(text_b_first)
            check(f"{cat_b} before {cat_a} → {cat_b}", result == cat_b)


if __name__ == "__main__":
    test_vin_helpers()
    test_categorization()
    test_category_renames()
    test_planning_and_execution()
    test_v2_regression_contracte_duplication()
    test_v2_regression_vin_nesting()
    test_v2_regression_no_source_mutation()
    test_threading_safety()
    test_threading_collision_safety()
    test_idempotency()
    test_excel_inventory()
    test_large_scale_threading()
    test_pdf_cross_copy()
    test_contract_gap_fill()
    test_reclassify_by_content()
    test_folder_name_vin_and_no_vin()
    test_rescan_rescue_no_vin()
    test_rescan_apply_renames()
    test_rescan_reclassify_rename_on_disk()
    test_partition_merging()
    test_rename_map_persistence()
    test_short_name_categorization()
    test_ledger_based_inventory()
    test_content_category_dominance()
    test_content_first_position_wins()

    print(f"\n{'='*60}")
    print(f"RESULTS: {PASS} passed, {FAIL} failed")
    if FAIL:
        print("SOME TESTS FAILED!")
        sys.exit(1)
    else:
        print("ALL TESTS PASSED!")