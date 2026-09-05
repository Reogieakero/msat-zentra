"use client";

import type { OcForm01Detail } from "./ocform01";
import styles from "./OcForm01Print.module.css";

interface OcForm01PrintProps {
  detail: OcForm01Detail;
}

/**
 * Screen + print rendering of the official OCForm-01 anecdotal template
 * (labelled GCForm-01 inside, per the template file). Mirrors the .xlsx
 * export row-for-row: DepEd header with both logos, ANECDOTAL REPORT title
 * block, observer/observation box, ruled narrative blocks, academic-info
 * section, and the PREPARED BY signature footer with the adviser's printed
 * name on the signature line. Prints cleanly to A4 portrait via the
 * `.ocform01-print-sheet` print rules in the CSS module.
 */
export function OcForm01Print({ detail }: OcForm01PrintProps) {
  return (
    <div className={`${styles.sheet} ocform01-print-sheet`}>
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ocform01/deped-logo.png"
          alt="Department of Education logo"
          className={styles.logoDeped}
        />
        <div className={styles.headerText}>
          <p>Republic of the Philippines</p>
          <p>Department of Education</p>
          <p>Region XI</p>
          <p>Schools Division of the City of Mati</p>
          <p className={styles.school}>MATI SCHOOL OF ARTS AND TRADES</p>
          <p>Quezon Ave., Barangay Sainz, City of Mati, Davao Oriental</p>
          <p>Tel # (087) 388-3448</p>
          <p className={styles.email}>Email Add: msat.mati@deped.gov.ph</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ocform01/msat-logo.png"
          alt="Mati School of Arts and Trades logo"
          className={styles.logoMsat}
        />
      </header>

      <div className={styles.titleBlock}>
        <p className={styles.title}>ANECDOTAL REPORT</p>
        <p className={styles.formCode}>GCForm-01</p>
        <p className={styles.confidential}>(Confidential)</p>
      </div>

      <div className={styles.box}>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Observer:</span>
            <span className={styles.input}>{detail.observerName}</span>
            <span className={styles.label}>Grade &amp; Section:</span>
            <span className={styles.input}>{detail.gradeSection}</span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Observation Date:</span>
            <span className={styles.input}>{detail.observationDate}</span>
            <span className={styles.label}>Observation Time:</span>
            <span className={styles.input}>{detail.observationTime}</span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Student Name(Subject):</span>
            <span className={`${styles.input} ${styles.span3}`}>
              {detail.studentName}
            </span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Grade &amp; Section:</span>
            <span className={`${styles.input} ${styles.span3}`}>
              {detail.gradeSection}
            </span>
          </div>
        </div>

        <SectionBlock
          heading="Description of the Incident:"
          text={detail.descriptionOfIncident}
        />
        <SectionBlock
          heading="Description of the Location/ Setting:"
          text={detail.descriptionOfLocation}
        />
        <SectionBlock
          heading="Notes/ Recommendations/ Actions:"
          text={detail.notesRecommendationsActions}
        />

        <p className={styles.academicHeading}>
          Academic Information of the Subject/Client:
        </p>
        <div className={styles.fieldGrid}>
          <div className={styles.fieldRow}>
            <span className={styles.label}>Class Performance:</span>
            <span className={`${styles.input} ${styles.span3}`}>
              {detail.classPerformance}
            </span>
          </div>
          <div className={styles.fieldRow}>
            <span className={styles.labelWide}>
              Attendance in Classes for the last 2 weeks/Month:
            </span>
            <span className={styles.inputFlex}>{detail.attendanceSummary}</span>
          </div>
          <div className={styles.blankRule} aria-hidden />
          <div className={styles.blankRule} aria-hidden />
        </div>
      </div>

      <footer className={styles.footer}>
        <p className={styles.prepared}>PREPARED BY:</p>
        <div className={styles.signatureRow}>
          <span className={styles.signatureSpacer} aria-hidden />
          <span className={styles.signatureLine}>
            {detail.signature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.signature.imageUrl}
                alt={`Signature of ${detail.signature.by}`}
                className={styles.signatureImage}
              />
            ) : null}
            {detail.adviserName}
          </span>
        </div>
        <p className={styles.signatureCaption}>
          ADVISER&apos;S SIGNATURE OVER PRINTED NAME
        </p>
      </footer>
    </div>
  );
}

function SectionBlock({ heading, text }: { heading: string; text: string }) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionHeading}>{heading}</p>
      <p className={styles.ruled}>{text || "\u00A0"}</p>
    </div>
  );
}
