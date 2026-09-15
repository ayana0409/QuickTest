package com.quicktest.modules.assessment;

import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.dto.AnswerOptionDto;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.service.QuestionServiceImpl;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for strict question business rules validation across all question types.
 */
class QuestionValidationTest {

    @Nested
    @DisplayName("SINGLE_CHOICE Validation Rules")
    class SingleChoiceRules {

        @Test
        @DisplayName("Should pass when there are at least 2 options and exactly 1 is correct")
        void shouldPassWithValidOptions() {
            List<AnswerOptionDto> options = Arrays.asList(
                    AnswerOptionDto.builder().content("Option A").isCorrect(true).build(),
                    AnswerOptionDto.builder().content("Option B").isCorrect(false).build()
            );

            assertDoesNotThrow(() -> QuestionServiceImpl.validateQuestionBusinessRules(
                    QuestionType.SINGLE_CHOICE, null, null, null, options));
        }

        @Test
        @DisplayName("Should fail when options list is null or has fewer than 2 options")
        void shouldFailWithInsufficientOptions() {
            List<AnswerOptionDto> singleOption = Collections.singletonList(
                    AnswerOptionDto.builder().content("Option A").isCorrect(true).build()
            );

            AppException ex1 = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.SINGLE_CHOICE, null, null, null, null));
            assertTrue(ex1.getMessage().contains("at least 2 answer options"));

            AppException ex2 = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.SINGLE_CHOICE, null, null, null, singleOption));
            assertTrue(ex2.getMessage().contains("at least 2 answer options"));
        }

        @Test
        @DisplayName("Should fail when no option is marked correct")
        void shouldFailWithNoCorrectOption() {
            List<AnswerOptionDto> options = Arrays.asList(
                    AnswerOptionDto.builder().content("Option A").isCorrect(false).build(),
                    AnswerOptionDto.builder().content("Option B").isCorrect(false).build()
            );

            AppException ex = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.SINGLE_CHOICE, null, null, null, options));
            assertTrue(ex.getMessage().contains("exactly one correct answer option"));
        }

        @Test
        @DisplayName("Should fail when multiple options are marked correct")
        void shouldFailWithMultipleCorrectOptions() {
            List<AnswerOptionDto> options = Arrays.asList(
                    AnswerOptionDto.builder().content("Option A").isCorrect(true).build(),
                    AnswerOptionDto.builder().content("Option B").isCorrect(true).build()
            );

            AppException ex = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.SINGLE_CHOICE, null, null, null, options));
            assertTrue(ex.getMessage().contains("exactly one correct answer option"));
        }
    }

    @Nested
    @DisplayName("MULTIPLE_CHOICE Validation Rules")
    class MultipleChoiceRules {

        @Test
        @DisplayName("Should pass when there are multiple correct options")
        void shouldPassWithMultipleCorrectOptions() {
            List<AnswerOptionDto> options = Arrays.asList(
                    AnswerOptionDto.builder().content("Option A").isCorrect(true).build(),
                    AnswerOptionDto.builder().content("Option B").isCorrect(true).build(),
                    AnswerOptionDto.builder().content("Option C").isCorrect(false).build()
            );

            assertDoesNotThrow(() -> QuestionServiceImpl.validateQuestionBusinessRules(
                    QuestionType.MULTIPLE_CHOICE, null, null, null, options));
        }

        @Test
        @DisplayName("Should fail when no option is marked correct")
        void shouldFailWithZeroCorrectOptions() {
            List<AnswerOptionDto> options = Arrays.asList(
                    AnswerOptionDto.builder().content("Option A").isCorrect(false).build(),
                    AnswerOptionDto.builder().content("Option B").isCorrect(false).build()
            );

            AppException ex = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.MULTIPLE_CHOICE, null, null, null, options));
            assertTrue(ex.getMessage().contains("at least one correct answer option"));
        }
    }

    @Nested
    @DisplayName("NUMERIC Validation Rules")
    class NumericRules {

        @Test
        @DisplayName("Should pass when sampleAnswer is a valid double and options are empty")
        void shouldPassWithValidDouble() {
            assertDoesNotThrow(() -> QuestionServiceImpl.validateQuestionBusinessRules(
                    QuestionType.NUMERIC, "3.14159", 0.01, null, null));
            assertDoesNotThrow(() -> QuestionServiceImpl.validateQuestionBusinessRules(
                    QuestionType.NUMERIC, "-42.5", null, null, Collections.emptyList()));
            // Support comma decimal separator (e.g. 78,5)
            assertDoesNotThrow(() -> QuestionServiceImpl.validateQuestionBusinessRules(
                    QuestionType.NUMERIC, "78,5", 0.1, null, null));
        }

        @Test
        @DisplayName("Should fail when options are attached to numeric question")
        void shouldFailWhenOptionsPresent() {
            List<AnswerOptionDto> options = Collections.singletonList(
                    AnswerOptionDto.builder().content("10").build()
            );

            AppException ex = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.NUMERIC, "10", 0.0, null, options));
            assertTrue(ex.getMessage().contains("must not contain answer options"));
        }

        @Test
        @DisplayName("Should fail when sampleAnswer cannot be parsed as double")
        void shouldFailWithInvalidDouble() {
            AppException ex1 = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.NUMERIC, "not_a_number", 0.0, null, null));
            assertTrue(ex1.getMessage().contains("valid number"));

            AppException ex2 = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.NUMERIC, "   ", 0.0, null, null));
            assertTrue(ex2.getMessage().contains("requires a valid sample answer"));
        }

        @Test
        @DisplayName("Should fail when numericTolerance is negative")
        void shouldFailWithNegativeTolerance() {
            AppException ex = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.NUMERIC, "100", -0.5, null, null));
            assertTrue(ex.getMessage().contains("cannot be negative"));
        }
    }

    @Nested
    @DisplayName("ESSAY_TEXT Validation Rules")
    class EssayRules {

        @Test
        @DisplayName("Should pass when gradingRubric is present (with or without sampleAnswer)")
        void shouldPassWithGradingRubric() {
            assertDoesNotThrow(() -> QuestionServiceImpl.validateQuestionBusinessRules(
                    QuestionType.ESSAY_TEXT, null, null, "Grading rubric criteria", null));

            assertDoesNotThrow(() -> QuestionServiceImpl.validateQuestionBusinessRules(
                    QuestionType.ESSAY_TEXT, "Optional sample answer", null, "Grading rubric criteria", null));
        }

        @Test
        @DisplayName("Should fail when gradingRubric is missing or blank")
        void shouldFailWhenGradingRubricMissing() {
            AppException ex1 = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.ESSAY_TEXT, "Sample only", null, null, null));
            assertTrue(ex1.getMessage().contains("requires a grading rubric"));

            AppException ex2 = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.ESSAY_TEXT, "Sample only", null, "   ", null));
            assertTrue(ex2.getMessage().contains("requires a grading rubric"));
        }

        @Test
        @DisplayName("Should fail when options are attached to essay question")
        void shouldFailWhenOptionsPresent() {
            List<AnswerOptionDto> options = Collections.singletonList(
                    AnswerOptionDto.builder().content("Text").build()
            );

            AppException ex = assertThrows(AppException.class, () ->
                    QuestionServiceImpl.validateQuestionBusinessRules(QuestionType.ESSAY_TEXT, "Sample", null, null, options));
            assertTrue(ex.getMessage().contains("must not contain answer options"));
        }
    }
}
