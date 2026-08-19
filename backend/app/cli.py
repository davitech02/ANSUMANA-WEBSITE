"""Flask CLI commands: ``create-admin`` and ``seed-demo``.

Both commands are idempotent. ``create-admin`` never prints the admin
password; the password is read from the ``AEC_ADMIN_PASSWORD`` environment
variable or an interactive prompt.
"""

from __future__ import annotations

import getpass
import json
import logging
import os
import secrets
from datetime import datetime, timezone

import click
from flask.cli import with_appcontext
from werkzeug.security import generate_password_hash

from .extensions import db
from .models import (
    Booking,
    BookingService,
    BookingStatus,
    CompanySettings,
    Evidence,
    Finding,
    NotificationChannel,
    NotificationDeliveryStatus,
    NotificationLog,
    NotificationType,
    Permit,
    PermitStatus,
    PermitType,
    Proponent,
    ProponentStatus,
    ProjectType,
    ReportSchedule,
    ReportStatus,
    ReportType,
    RequestService,
    RequestStatus,
    ServiceRequest,
    User,
    UserRole,
)
from .models.enums import ActionStatus, ComplianceStatus, ReviewStatus, RiskLevel
from .utils.text import normalize_email

DEFAULT_ADMIN_EMAIL = "info@ansumana.com"
DEFAULT_ADMIN_NAME = "Dr. Ansumana Kamara (AEC Admin)"

_MIN_PASSWORD_LENGTH = 8


def _resolve_admin_password(provided: str | None) -> str:
    """Return a password from flag, environment, or interactive prompt."""
    password = provided or os.environ.get("AEC_ADMIN_PASSWORD", "") or ""
    if not password:
        password = getpass.getpass("Admin password: ")
    if not password:
        raise click.ClickException("Password cannot be empty.")
    if len(password) < _MIN_PASSWORD_LENGTH:
        raise click.ClickException(
            f"Password must be at least {_MIN_PASSWORD_LENGTH} characters long."
        )
    return password


@click.command("create-admin")
@click.option(
    "--email",
    "email",
    default=None,
    help=f"Admin email (default: AEC_ADMIN_EMAIL or {DEFAULT_ADMIN_EMAIL})",
)
@click.option(
    "--name",
    "name",
    default=None,
    help="Admin display name (default: AEC_ADMIN_NAME or the AEC admin name)",
)
@click.option(
    "--password",
    "password",
    default=None,
    help="Admin password (default: AEC_ADMIN_PASSWORD or interactive prompt)",
)
@click.option(
    "--reset-password",
    "reset",
    is_flag=True,
    help="Update the password even if the admin account already exists",
)
@with_appcontext
def create_admin_command(email, name, password, reset) -> None:
    """Create (or verify) the AEC portal administrator account."""
    email = normalize_email(email or os.environ.get("AEC_ADMIN_EMAIL") or DEFAULT_ADMIN_EMAIL)
    name = name or os.environ.get("AEC_ADMIN_NAME") or DEFAULT_ADMIN_NAME

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if user is not None and not reset:
        click.echo(f"Admin already exists ({email}); nothing to do.")
        return

    resolved = _resolve_admin_password(password)
    if user is None:
        user = User(
            email=email,
            full_name=name,
            role=UserRole.ADMIN,
            is_active=True,
            password_hash=generate_password_hash(resolved, method="pbkdf2:sha256"),
        )
        db.session.add(user)
        click.echo(f"Admin account created: {email}")
    else:
        user.role = UserRole.ADMIN
        user.is_active = True
        user.password_hash = generate_password_hash(resolved, method="pbkdf2:sha256")
        click.echo(f"Admin account updated: {email}")
    db.session.commit()
    click.echo("Done.")


def _client_password() -> str:
    """Return a client password from AEC_DEMO_PASSWORD or a random value."""
    return os.environ.get("AEC_DEMO_PASSWORD") or secrets.token_urlsafe(24)


@click.command("seed-demo")
@click.option(
    "--force",
    "force",
    is_flag=True,
    help="Delete existing demo data and re-seed",
)
@with_appcontext
def seed_demo_command(force) -> None:
    """Seed reference demo data mirroring the frontend seed (idempotent)."""
    if Proponent.query.first() is not None:
        if not force:
            click.echo("Demo data already present; skipping (use --force to re-seed).")
            return
        _clear_demo_data()
        click.echo("Cleared existing demo data.")

    settings = CompanySettings(
        company_name="Ansumana Environmental Consultancy Inc. (AEC)",
        company_email="info@ansumana.com",
        company_phone="+231 088 125 2254",
        company_whatsapp="+231 077 530 1445",
        company_address="72nd SKD Boulevard, Opposite Praise International Church Paynesville, Liberia",
        company_tagline="Precision Stewardship for a Sustainable Future",
        enable_email_notifications=True,
        enable_whatsapp_notifications=True,
        reminder_30_enabled=True,
        reminder_14_enabled=True,
        reminder_7_enabled=True,
        reminder_1_enabled=True,
    )
    db.session.add(settings)

    p1 = Proponent(
        company_name="Liberia Gold Mining Ltd.",
        contact_person="Mohamed Sesay",
        email="compliance@liberiagold.lr",
        phone="+231 088 554 3210",
        whatsapp_number="+231 077 554 3210",
        project_type=ProjectType.GOLD_MINING,
        county="Nimba County",
        district="Sanniquellie District",
        project_location="Yekepa Mining Lease Area",
        project_description="Open-pit gold exploration and tailings processing facility.",
        status=ProponentStatus.ACTIVE,
    )
    p2 = Proponent(
        company_name="Monrovia Cold Storage & Marine Logistics",
        contact_person="Fatu Bangura",
        email="env@monroviacoldstorage.lr",
        phone="+231 088 112 3344",
        whatsapp_number="+231 077 112 3344",
        project_type=ProjectType.COLD_STORAGE,
        county="Montserrado County",
        district="Freeport Area",
        project_location="Freeport of Monrovia Berth 3",
        project_description="Industrial ammonia refrigeration cold store and seafood export logistics hub.",
        status=ProponentStatus.ACTIVE,
    )
    p3 = Proponent(
        company_name="Nimba Granite Quarry & Aggregate Resources",
        contact_person="Sahr Dumbuya",
        email="sdumbuya@nimbaaggregate.lr",
        phone="+231 088 998 8770",
        whatsapp_number="+231 077 998 8770",
        project_type=ProjectType.MINING_AND_QUARRY,
        county="Nimba County",
        district="Ganta District",
        project_location="Ganta Highway Sector 4",
        project_description="Hard rock granite crushing plant producing road construction aggregates.",
        status=ProponentStatus.ACTIVE,
    )
    p4 = Proponent(
        company_name="Ducor Luxury Resort & Eco-Lodge",
        contact_person="Amina Mansaray",
        email="management@ducor-ecolodge.lr",
        phone="+231 088 443 2100",
        whatsapp_number="+231 077 443 2100",
        project_type=ProjectType.HOTEL,
        county="Montserrado County",
        district="Paynesville",
        project_location="72nd SKD Boulevard Coastal Zone",
        project_description="Coastal eco-resort with wastewater treatment and solar hybrid microgrid.",
        status=ProponentStatus.ACTIVE,
    )
    db.session.add_all([p1, p2, p3, p4])
    db.session.flush()

    client_password = _client_password()
    u1 = User(
        email="compliance@liberiagold.lr",
        full_name="Liberia Gold Mining Ltd. Compliance Officer",
        role=UserRole.CLIENT,
        is_active=True,
        proponent_id=p1.id,
        password_hash=generate_password_hash(client_password, method="pbkdf2:sha256"),
    )
    u2 = User(
        email="env@monroviacoldstorage.lr",
        full_name="Monrovia Cold Storage Operations Manager",
        role=UserRole.CLIENT,
        is_active=True,
        proponent_id=p2.id,
        password_hash=generate_password_hash(client_password, method="pbkdf2:sha256"),
    )
    db.session.add_all([u1, u2])
    db.session.flush()

    perm1 = Permit(
        proponent_id=p1.id,
        permit_number="EPA-LR-MIN-2025-089",
        permit_type=PermitType.EPA_ENVIRONMENTAL_PERMIT,
        issue_date=datetime(2025, 3, 1).date(),
        expiry_date=datetime(2026, 8, 28).date(),
        status=PermitStatus.ACTIVE,
    )
    perm2 = Permit(
        proponent_id=p2.id,
        permit_number="EPA-LR-IND-2025-042",
        permit_type=PermitType.EPA_ENVIRONMENTAL_PERMIT,
        issue_date=datetime(2025, 9, 15).date(),
        expiry_date=datetime(2026, 9, 14).date(),
        status=PermitStatus.ACTIVE,
    )
    perm3 = Permit(
        proponent_id=p3.id,
        permit_number="EPA-LR-ML-2024-112",
        permit_type=PermitType.MINING_LICENSE,
        issue_date=datetime(2024, 8, 10).date(),
        expiry_date=datetime(2026, 8, 15).date(),
        status=PermitStatus.PENDING_RENEWAL,
    )
    perm4 = Permit(
        proponent_id=p4.id,
        permit_number="EPA-LR-EIA-2025-201",
        permit_type=PermitType.ENVIRONMENTAL_IMPACT_LICENSE,
        issue_date=datetime(2025, 1, 10).date(),
        expiry_date=datetime(2027, 1, 9).date(),
        status=PermitStatus.ACTIVE,
    )
    db.session.add_all([perm1, perm2, perm3, perm4])
    db.session.flush()

    sched1 = ReportSchedule(
        proponent_id=p1.id,
        permit_id=perm1.id,
        report_type=ReportType.BIANNUAL_MONITORING_REPORT,
        reporting_period="Q1-Q2 2026 Compliance Monitoring",
        due_date=datetime(2026, 8, 25).date(),
        status=ReportStatus.PENDING,
        reminder_30_sent=True,
        reminder_14_sent=True,
    )
    sched2 = ReportSchedule(
        proponent_id=p2.id,
        permit_id=perm2.id,
        report_type=ReportType.QUARTERLY_MONITORING_REPORT,
        reporting_period="Q2 2026 Refrigerant Safety & Waste Audit",
        due_date=datetime(2026, 8, 18).date(),
        status=ReportStatus.PENDING,
        reminder_30_sent=True,
        reminder_14_sent=True,
        reminder_7_sent=True,
    )
    sched3 = ReportSchedule(
        proponent_id=p3.id,
        permit_id=perm3.id,
        report_type=ReportType.ENVIRONMENTAL_AUDIT_REPORT,
        reporting_period="Annual Reclamation & Dust Control Audit",
        due_date=datetime(2026, 8, 1).date(),
        status=ReportStatus.OVERDUE,
        reminder_30_sent=True,
        reminder_14_sent=True,
        reminder_7_sent=True,
        reminder_1_sent=True,
        reminder_due_sent=True,
        reminder_overdue_sent=True,
    )
    sched4 = ReportSchedule(
        proponent_id=p4.id,
        permit_id=perm4.id,
        report_type=ReportType.QUARTERLY_MONITORING_REPORT,
        reporting_period="Q3 2026 Coastal Wastewater Discharge Monitoring",
        due_date=datetime(2026, 9, 30).date(),
        status=ReportStatus.PENDING,
    )
    db.session.add_all([sched1, sched2, sched3, sched4])
    db.session.flush()

    find1 = Finding(
        proponent_id=p1.id,
        report_schedule_id=sched1.id,
        inspection_area="Tailings Retention Dam & Cyanide Storage Bay",
        finding_title="Inadequate Spill Containment Bunding around Reagent Tank",
        finding_description="The secondary containment bund wall at the cyanide leaching reagent shed exhibits 15cm cracks and incomplete masonry lining, posing run-off risks to local streams during torrential rains.",
        compliance_status=ComplianceStatus.MAJOR_NON_COMPLIANCE,
        risk_level=RiskLevel.HIGH,
        corrective_action="Seal all structural cracks in secondary containment bund with epoxy mortar and apply chemical-resistant membrane sealant.",
        recommendation="Perform daily integrity checks and install automated secondary containment sump alarm.",
        action_deadline=datetime(2026, 8, 20).date(),
        responsible_party="Mine HSE Manager (Mohamed Sesay)",
        action_status=ActionStatus.SUBMITTED_FOR_REVIEW,
        sent_to_proponent=True,
    )
    find2 = Finding(
        proponent_id=p1.id,
        report_schedule_id=sched1.id,
        inspection_area="Artisanal Pits & Soil Reclamation Zone C",
        finding_title="Unvegetated Slope Soil Erosion near Drainage Trench",
        finding_description="Siltation observed in nearby stream discharge channel due to lack of vetiver grass turfing on freshly excavated overburden stock slopes.",
        compliance_status=ComplianceStatus.MINOR_NON_COMPLIANCE,
        risk_level=RiskLevel.MEDIUM,
        corrective_action="Deploy sediment silt fences along slope base and initiate bio-engineering re-vegetation with fast-rooting local grass species.",
        recommendation="Construct sediment retention traps at 50-meter intervals.",
        action_deadline=datetime(2026, 8, 30).date(),
        responsible_party="Liberia Gold Site Civil Team",
        action_status=ActionStatus.IN_PROGRESS,
        sent_to_proponent=True,
    )
    find3 = Finding(
        proponent_id=p2.id,
        report_schedule_id=sched2.id,
        inspection_area="Ammonia Compressor Room 2",
        finding_title="Expired Gas Detector Calibration Certificates",
        finding_description="Ammonia gas sensors installed in Compressor Room 2 passed expiration inspection dates in May 2026 without documented re-calibration.",
        compliance_status=ComplianceStatus.OBSERVATION,
        risk_level=RiskLevel.LOW,
        corrective_action="Engage certified technician to re-calibrate gas sensors and upload updated calibration certificates to portal.",
        recommendation="Maintain a digital calibration logbook with automatic 30-day alerts.",
        action_deadline=datetime(2026, 8, 22).date(),
        responsible_party="Fatu Bangura (Maintenance Operations)",
        action_status=ActionStatus.PENDING,
        sent_to_proponent=True,
    )
    find4 = Finding(
        proponent_id=p3.id,
        report_schedule_id=sched3.id,
        inspection_area="Primary Jaw Crusher & Haul Road Sector",
        finding_title="Uncontrolled Fugitive Dust Emissions during Crushing Operations",
        finding_description="Dust suppression water sprayers on the primary jaw crusher were found inactive, causing heavy airborne particulate pollution affecting nearby village settlements.",
        compliance_status=ComplianceStatus.MAJOR_NON_COMPLIANCE,
        risk_level=RiskLevel.HIGH,
        corrective_action="Repair main water pressure pump, restore automated misting suppression system, and operate dedicated water bowser along haul roads hourly.",
        recommendation="Implement continuous PM10 air quality monitoring sensors.",
        action_deadline=datetime(2026, 8, 10).date(),
        responsible_party="Quarry Manager (Sahr Dumbuya)",
        action_status=ActionStatus.OVERDUE,
        sent_to_proponent=True,
    )
    db.session.add_all([find1, find2, find3, find4])
    db.session.flush()

    ev1 = Evidence(
        finding_id=find1.id,
        proponent_id=p1.id,
        evidence_title="Bund Reinforcement Mortar Photos",
        description="Repaired bund wall with epoxy mortar, sealed all hairline fractures, and applied chemical membrane. Photos and material receipt attached.",
        review_status=ReviewStatus.PENDING_REVIEW,
        submitted_at=datetime(2026, 8, 8, 14, 20, tzinfo=timezone.utc),
    )
    db.session.add(ev1)

    book1 = Booking(
        proponent_id=p1.id,
        created_by=u1.id,
        full_name="Mohamed Sesay",
        company_name="Liberia Gold Mining Ltd.",
        email="compliance@liberiagold.lr",
        phone="+231 088 554 3210",
        whatsapp_number="+231 077 554 3210",
        service_needed=BookingService.BIANNUAL_MONITORING_PLANNING_SESSION,
        preferred_date=datetime(2026, 8, 16).date(),
        preferred_time="10:00 AM",
        project_location="Yekepa Site / AEC Paynesville Office",
        message="Requesting pre-audit review call with AEC environmental lead ahead of EPA Liberia inspection.",
        booking_status=BookingStatus.CONFIRMED,
        meeting_link="https://meet.google.com/aec-lr-gold-2026",
    )
    book2 = Booking(
        full_name="David Koroma",
        company_name="Sinoe Timber & Logging Co.",
        email="dkoroma@sinoetimber.lr",
        phone="+231 088 331 1122",
        whatsapp_number="+231 077 331 1122",
        service_needed=BookingService.ESIA_EMP_EPB_CONSULTATION,
        preferred_date=datetime(2026, 8, 20).date(),
        preferred_time="02:00 PM",
        project_location="Sinoe Forestry Zone",
        message="Need advice on preparing Environmental Project Brief for new sustainable timber concession.",
        booking_status=BookingStatus.PENDING,
    )
    db.session.add_all([book1, book2])

    req1 = ServiceRequest(
        full_name="Josephine Kamara",
        company_name="Atlantic Fish Freezing Plant",
        email="jkamara@atlanticfish.lr",
        phone="+231 088 769 9900",
        whatsapp_number="+231 077 769 9900",
        service_needed=RequestService.ENVIRONMENTAL_AUDIT_REPORT,
        project_location="Freeport Dockyard, Monrovia",
        message="We require a full annual EPA environmental audit report for our cold chain seafood processing factory.",
        status=RequestStatus.NEW,
    )
    req2 = ServiceRequest(
        full_name="Emmanuel Conteh",
        company_name="St. Paul River Sand Mining Association",
        email="econteh@stpaulsand.lr",
        phone="+231 088 823 4567",
        whatsapp_number="+231 077 823 4567",
        service_needed=RequestService.MINING_LICENSE_SUPPORT,
        project_location="Montserrado / St. Paul Riverbank",
        message="Seeking AEC compliance advisory to obtain EPA mining permit for organized riverbed sand extraction.",
        status=RequestStatus.CONTACTED,
    )
    db.session.add_all([req1, req2])

    log1 = NotificationLog(
        proponent_id=p1.id,
        report_schedule_id=sched1.id,
        channel=NotificationChannel.EMAIL,
        notification_type=NotificationType.REPORT_REMINDER,
        recipient="compliance@liberiagold.lr",
        subject="AEC Compliance Notice: Biannual Monitoring Report Due in 14 Days",
        message_body="Dear Mohamed Sesay, this is a reminder from Ansumana Environmental Consultancy Inc. Your Biannual Monitoring Report for Liberia Gold Mining Ltd. is due on 2026-08-25. Please contact AEC to arrange final monitoring submissions.",
        status=NotificationDeliveryStatus.SENT,
        sent_at=datetime(2026, 8, 11, 8, 0, tzinfo=timezone.utc),
    )
    log2 = NotificationLog(
        proponent_id=p1.id,
        report_schedule_id=sched1.id,
        channel=NotificationChannel.WHATSAPP,
        notification_type=NotificationType.REPORT_REMINDER,
        recipient="+231 077 554 3210",
        subject="WhatsApp Alert: Report Deadline Reminder",
        message_body="[AEC Alert] Dear Mohamed Sesay, Biannual Monitoring Report for Liberia Gold Mining Ltd. is due on 2026-08-25. Log into AEC Portal to manage findings.",
        status=NotificationDeliveryStatus.SENT,
        sent_at=datetime(2026, 8, 11, 8, 1, tzinfo=timezone.utc),
    )
    log3 = NotificationLog(
        proponent_id=p3.id,
        report_schedule_id=sched3.id,
        channel=NotificationChannel.EMAIL,
        notification_type=NotificationType.OVERDUE_NOTICE,
        recipient="sdumbuya@nimbaaggregate.lr",
        subject="URGENT: Environmental Audit Report is OVERDUE - EPA Liberia Notice",
        message_body="Dear Sahr Dumbuya, your Environmental Audit Report due on 2026-08-01 is currently overdue. Please contact AEC immediately to avoid regulatory sanctions.",
        status=NotificationDeliveryStatus.SENT,
        sent_at=datetime(2026, 8, 2, 9, 0, tzinfo=timezone.utc),
    )
    db.session.add_all([log1, log2, log3])

    db.session.commit()
    click.echo(
        "Demo data seeded: 4 proponents, 4 permits, 4 schedules, 4 findings, "
        "1 evidence, 2 bookings, 2 service requests, 3 notification logs, "
        "2 client users, 1 company settings."
    )
    if not os.environ.get("AEC_DEMO_PASSWORD"):
        click.echo(
            "Client accounts use a random password. Re-run with --force and "
            "AEC_DEMO_PASSWORD set to assign a known password."
        )


@click.command("run-reminders")
@click.option(
    "--dry-run",
    "dry_run",
    is_flag=True,
    help="Preview what would be sent without claiming flags or dispatching",
)
@with_appcontext
def run_reminders_command(dry_run) -> None:
    """Run the automated reminder engine (scheduler entry point).

    Suitable for invocation by an external scheduler (e.g. a cron/Windows
    Task Scheduler line ``flask run-reminders``). Prints the aggregated run
    summary as JSON and exits 0 on success (including runs where individual
    provider deliveries failed, per the reminder-service isolation contract).
    An operational failure (e.g. the database being unavailable) exits
    non-zero. No secrets, recipients, or raw provider output are ever printed.
    """
    from .services import reminder_service

    try:
        summary = reminder_service.run_reminders(dry_run=dry_run)
    except Exception:
        logging.getLogger("aec.cli").exception(
            "Reminder run failed.", extra={"event": "reminder_run_failed"}
        )
        raise click.ClickException(
            "Reminder run failed. Check the application logs for details."
        )
    click.echo(json.dumps(summary, indent=2))


def _clear_demo_data() -> None:
    """Delete demo-managed rows in reverse dependency order."""
    NotificationLog.query.delete()
    Evidence.query.delete()
    Finding.query.delete()
    ReportSchedule.query.delete()
    Permit.query.delete()
    Booking.query.delete()
    ServiceRequest.query.delete()
    User.query.filter(User.proponent_id.isnot(None)).delete()
    Proponent.query.delete()
    CompanySettings.query.delete()
    db.session.commit()


def register_commands(app) -> None:
    """Register CLI commands on the Flask application."""
    app.cli.add_command(create_admin_command)
    app.cli.add_command(seed_demo_command)
    app.cli.add_command(run_reminders_command)