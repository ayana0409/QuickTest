package com.quicktest.modules.assessment.service;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.core.service.CloudinaryStorageService;
import com.quicktest.modules.assessment.dto.ExamCloneTaskMessage;
import com.quicktest.modules.assessment.dto.ExamCloneTaskMessage.ImageCloneItem;
import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * RabbitMQ consumer handling background asynchronous image duplication for cloned exams.
 * Once all images have been cloned into new assets with distinct public IDs, the exam
 * is transitioned from CLONING to DRAFT and made visible to the teacher.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ExamCloneConsumer {

    private final CloudinaryStorageService cloudinaryStorageService;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final AnswerOptionRepository answerOptionRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Consumes exam clone image duplication tasks from RabbitMQ.
     *
     * @param message metadata containing the new exam ID and list of images to duplicate
     */
    @RabbitListener(queues = RabbitMQConfig.EXAM_CLONE_QUEUE)
    public void processExamClone(ExamCloneTaskMessage message) {
        log.info("Processing exam clone task for newExamId={}, teacherId={}, imageCount={}",
                message.getNewExamId(), message.getTeacherId(),
                message.getItems() != null ? message.getItems().size() : 0);

        if (message.getItems() != null && !message.getItems().isEmpty()) {
            for (ImageCloneItem item : message.getItems()) {
                try {
                    MediaUploadResponse response = cloudinaryStorageService.duplicateImage(
                            item.getSourceUrl(), item.getTargetFolder());

                    if (item.getOptionId() != null) {
                        answerOptionRepository.findById(item.getOptionId()).ifPresent(opt -> {
                            opt.setImageUrl(response.getUrl());
                            opt.setImagePublicId(response.getPublicId());
                            answerOptionRepository.save(opt);
                        });
                    } else if (item.getQuestionId() != null) {
                        questionRepository.findById(item.getQuestionId()).ifPresent(q -> {
                            q.setImageUrl(response.getUrl());
                            q.setImagePublicId(response.getPublicId());
                            questionRepository.save(q);
                        });
                    }
                } catch (Exception e) {
                    log.warn("Failed to duplicate image for item [questionId={}, optionId={}]: {}. Retaining source image URL as fallback.",
                            item.getQuestionId(), item.getOptionId(), e.getMessage());
                }
            }
        }

        // Once all images are duplicated, transition the exam to DRAFT so it becomes visible
        examRepository.findById(message.getNewExamId()).ifPresent(exam -> {
            exam.setStatus(ExamStatus.DRAFT);
            examRepository.save(exam);
            log.info("Exam ID {} completed duplication and transitioned to DRAFT", exam.getId());

            // Notify teacher via WebSocket real-time channel
            if (messagingTemplate != null && message.getTeacherId() != null) {
                try {
                    String destination = "/topic/teachers/" + message.getTeacherId() + "/notifications";
                    messagingTemplate.convertAndSend(destination, Map.of(
                            "type", "EXAM_CLONED",
                            "examId", exam.getId().toString(),
                            "title", exam.getTitle(),
                            "message", "Đề thi '" + exam.getTitle() + "' đã được nhân bản hoàn tất!"
                    ));
                    log.info("Sent EXAM_CLONED WebSocket notification to {}", destination);
                } catch (Exception wsEx) {
                    log.warn("Failed to send WebSocket notification for cloned exam {}: {}", exam.getId(), wsEx.getMessage());
                }
            }
        });
    }
}
