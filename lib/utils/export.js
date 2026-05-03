/**
 * Export utilities for analysis reports
 */

/**
 * Export report data as JSON
 */
export function exportAsJSON(data, filename = "chatvibe-report.json") {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert report data to CSV format
 */
function reportToCSV(report) {
  const lines = [];
  
  // Header
  lines.push("ChatVibe Analysis Report");
  lines.push(`Generated: ${new Date(report.createdAt || Date.now()).toISOString()}`);
  lines.push("");
  
  // Gemini Summary
  if (report.geminiSummary) {
    lines.push("=== GEMINI SUMMARY ===");
    lines.push(`Overall Vibe: ${report.geminiSummary.overall_vibe || "N/A"}`);
    lines.push(`Summary: ${report.geminiSummary.summary || "N/A"}`);
    if (report.geminiSummary.metrics) {
      lines.push("");
      lines.push("Emotional Metrics:");
      Object.entries(report.geminiSummary.metrics).forEach(([key, value]) => {
        lines.push(`${key},${value}%`);
      });
    }
    if (report.geminiSummary.behavior_flags?.length) {
      lines.push("");
      lines.push("Behavior Flags:");
      lines.push(report.geminiSummary.behavior_flags.join(", "));
    }
    if (report.geminiSummary.advice) {
      lines.push("");
      lines.push(`Advice: ${report.geminiSummary.advice}`);
    }
    lines.push("");
  }
  
  // Analytics
  if (report.analytics) {
    lines.push("=== ANALYTICS ===");
    
    // Sentiment Timeline
    if (report.analytics.sentimentTimeline?.length) {
      lines.push("");
      lines.push("Sentiment Timeline:");
      lines.push("Message Index,Sentiment Score");
      report.analytics.sentimentTimeline.forEach((item) => {
        lines.push(`${item.index},${item.sentiment}`);
      });
    }
    
    // Toxicity
    if (report.analytics.toxicity) {
      lines.push("");
      lines.push("Toxicity Analysis:");
      lines.push(`Average Toxicity: ${report.analytics.toxicity.average || 0}`);
      if (report.analytics.toxicity.perMessage?.length) {
        lines.push("");
        lines.push("Per-Message Toxicity:");
        lines.push("Message Index,Toxicity Score");
        report.analytics.toxicity.perMessage.forEach((item) => {
          lines.push(`${item.index},${item.score}`);
        });
      }
    }
    
    // Dominance
    if (report.analytics.dominance?.speakers) {
      lines.push("");
      lines.push("Conversation Dominance:");
      lines.push("Speaker,Percentage");
      Object.entries(report.analytics.dominance.speakers).forEach(([speaker, percentage]) => {
        lines.push(`Speaker ${speaker},${percentage}%`);
      });
    }
    
    // Keyword Clusters
    if (report.analytics.keywordClusters?.length) {
      lines.push("");
      lines.push("Keyword Clusters:");
      lines.push("Keyword,Count");
      report.analytics.keywordClusters.forEach((cluster) => {
        lines.push(`${cluster.keyword},${cluster.count}`);
      });
    }
    
    // Behavior Flags
    if (report.analytics.behaviorFlags) {
      lines.push("");
      lines.push("Behavior Flags:");
      const flags = ["anxious", "avoidant", "manipulation", "clinginess", "indifference", "inconsistency"];
      flags.forEach((flag) => {
        const detected = report.analytics.behaviorFlags[flag] ? "Yes" : "No";
        lines.push(`${flag},${detected}`);
      });
    }
  }
  
  // OCR Transcript
  if (report.ocrTranscript) {
    lines.push("");
    lines.push("=== OCR TRANSCRIPT ===");
    lines.push(report.ocrTranscript);
  }
  
  return lines.join("\n");
}

/**
 * Export report data as CSV
 */
export function exportAsCSV(report, filename = "chatvibe-report.csv") {
  const csvContent = reportToCSV(report);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export report as PDF using jsPDF
 */
export async function exportAsPDF(report, filename = "chatvibe-report.pdf") {
  // Dynamic import to avoid SSR issues
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  
  let yPos = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const lineHeight = 7;
  
  // Helper to add new page if needed
  const checkNewPage = (requiredSpace = lineHeight) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };
  
  // Title
  doc.setFontSize(18);
  doc.text("ChatVibe Analysis Report", margin, yPos);
  yPos += 10;
  
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date(report.createdAt || Date.now()).toLocaleString()}`, margin, yPos);
  yPos += 15;
  
  // Gemini Summary
  if (report.geminiSummary) {
    checkNewPage(15);
    doc.setFontSize(14);
    doc.text("Gemini Summary", margin, yPos);
    yPos += 8;
    
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(report.geminiSummary.overall_vibe || "N/A", margin, yPos);
    yPos += 7;
    
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(report.geminiSummary.summary || "N/A", 170);
    summaryLines.forEach((line) => {
      checkNewPage();
      doc.text(line, margin, yPos);
      yPos += lineHeight;
    });
    yPos += 5;
    
    // Metrics
    if (report.geminiSummary.metrics) {
      checkNewPage(10);
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text("Emotional Metrics:", margin, yPos);
      yPos += 7;
      
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      Object.entries(report.geminiSummary.metrics).forEach(([key, value]) => {
        checkNewPage();
        doc.text(`${key.replace("_", " ")}: ${value}%`, margin + 5, yPos);
        yPos += lineHeight;
      });
      yPos += 5;
    }
  }
  
  // Analytics Summary
  if (report.analytics) {
    checkNewPage(15);
    doc.setFontSize(14);
    doc.text("Analytics Summary", margin, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    
    // Toxicity
    if (report.analytics.toxicity?.average !== undefined) {
      checkNewPage();
      doc.text(`Average Toxicity: ${(report.analytics.toxicity.average * 100).toFixed(1)}%`, margin, yPos);
      yPos += lineHeight;
    }
    
    // Dominance
    if (report.analytics.dominance?.speakers) {
      checkNewPage();
      doc.text("Conversation Dominance:", margin, yPos);
      yPos += lineHeight;
      Object.entries(report.analytics.dominance.speakers).forEach(([speaker, percentage]) => {
        checkNewPage();
        doc.text(`  Speaker ${speaker}: ${percentage}%`, margin + 5, yPos);
        yPos += lineHeight;
      });
    }
    
    // Behavior Flags
    if (report.analytics.behaviorFlags) {
      checkNewPage(10);
      const flags = ["anxious", "avoidant", "manipulation", "clinginess", "indifference", "inconsistency"];
      const detectedFlags = flags.filter((flag) => report.analytics.behaviorFlags[flag]);
      if (detectedFlags.length > 0) {
        doc.text(`Behavior Flags Detected: ${detectedFlags.join(", ")}`, margin, yPos);
        yPos += lineHeight;
      }
    }
  }
  
  // OCR Transcript (truncated for PDF)
  if (report.ocrTranscript) {
    checkNewPage(15);
    doc.setFontSize(14);
    doc.text("OCR Transcript", margin, yPos);
    yPos += 10;
    
    doc.setFontSize(9);
    const transcriptLines = doc.splitTextToSize(report.ocrTranscript.substring(0, 2000), 170);
    transcriptLines.forEach((line) => {
      checkNewPage();
      doc.text(line, margin, yPos);
      yPos += lineHeight;
    });
    
    if (report.ocrTranscript.length > 2000) {
      checkNewPage();
      doc.text("... (truncated)", margin, yPos);
    }
  }
  
  doc.save(filename);
}

