package org.dcm4chee.arc.export.mgt.impl;

import org.dcm4che3.net.Device;
import org.dcm4chee.arc.conf.ArchiveDeviceExtension;
import org.dcm4chee.arc.conf.ExporterDescriptor;
import org.dcm4chee.arc.entity.QueueMessage;
import org.dcm4chee.arc.export.mgt.ExportManager;
import org.dcm4chee.arc.exporter.ExportContext;
import org.dcm4chee.arc.exporter.Exporter;
import org.dcm4chee.arc.exporter.ExporterFactory;
import org.dcm4chee.arc.qmgt.Outcome;
import org.dcm4chee.arc.qmgt.QueueManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ejb.TransactionAttribute;
import javax.ejb.TransactionAttributeType;
import javax.enterprise.event.Event;
import javax.inject.Inject;
import javax.jms.JMSException;
import javax.jms.Message;
import javax.jms.MessageListener;

/**
 * @author Gunter Zeilinger <gunterze@gmail.com>
 * @author Vrinda Nayak <vrinda.nayak@j4care.com>
 * @since Oct 2015
 */
@TransactionAttribute(TransactionAttributeType.NOT_SUPPORTED)
public class ExportManagerMDB implements MessageListener {
    private static final Logger LOG = LoggerFactory.getLogger(ExportManagerMDB.class);

    @Inject
    private ExportManager ejb;

    @Inject
    private QueueManager queueManager;

    @Inject
    private ExporterFactory exporterFactory;

    @Inject
    private Event<ExportContext> exportEvent;

    @Inject
    private Device device;

    @Override
    public void onMessage(Message msg) {
        String msgID;
        try {
            msgID = msg.getJMSMessageID();
        } catch (JMSException e) {
            LOG.error("Failed to process {}", msg, e);
            return;
        }
        QueueMessage queueMessage = queueManager.onProcessingStart(msgID);
        if (queueMessage == null)
            return;

        Long exportTaskPk = (Long) queueMessage.getMessageBody();
        Outcome outcome;
        try {
            ejb.updateExportTask(exportTaskPk);
            Exporter exporter = exporterFactory.getExporter(getExporterDescriptor(msg.getStringProperty("ExporterID")));
            ExportContext exportContext = exporter.createExportContext();
            exportContext.setMessageID(msgID);
            exportContext.setStudyInstanceUID(msg.getStringProperty("StudyInstanceUID"));
            exportContext.setSeriesInstanceUID(msg.getStringProperty("SeriesInstanceUID"));
            exportContext.setSopInstanceUID(msg.getStringProperty("SopInstanceUID"));
            exportContext.setAETitle(msg.getStringProperty("AETitle"));
            outcome = exporter.export(exportContext);
            exportContext.setOutcome(outcome);
            exportEvent.fire(exportContext);
        } catch (Throwable e) {
            LOG.warn("Failed to process {}", msg, e);
            queueManager.onProcessingFailed(msgID, e);
            ejb.updateExportTask(exportTaskPk);
            return;
        }
        queueManager.onProcessingSuccessful(msgID, outcome);
        ejb.updateExportTask(exportTaskPk);
    }

    private ExporterDescriptor getExporterDescriptor(String exporterID) {
        return device.getDeviceExtension(ArchiveDeviceExtension.class).getExporterDescriptor(exporterID);
    }
}
