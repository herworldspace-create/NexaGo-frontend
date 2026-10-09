'use client'

import { Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { submitRideRating } from '../../lib/api'
import { friendlyError } from '../../lib/format'
import { BottomSheet } from '../bottom-sheet'
import { TipDriver } from './tip-driver'

const POSITIVE_TAGS = ['Safe driving', 'Clean car', 'Friendly', 'On time', 'Great route', 'Good music']
const NEGATIVE_TAGS = ['Unsafe driving', 'Late pickup', 'Dirty car', 'Rude', 'Wrong route', 'Overcharged']
const scoreCopy = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent']

type PostTripSheetProps = {
  rideId: string
  onClose: () => void
  onDone: (message: string) => void
}

export function PostTripSheet({ rideId, onClose, onDone }: PostTripSheetProps) {
  const [score, setScore] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [rated, setRated] = useState(false)

  const tagOptions = score >= 4 ? POSITIVE_TAGS : score > 0 ? NEGATIVE_TAGS : []

  const chooseScore = (value: number) => {
    const sameGroup = (value >= 4) === (score >= 4)
    setScore(value)
    if (!sameGroup) setTags([])
    setError('')
  }

  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (score < 1) return setError('Choose a star rating before submitting.')
    const note = [tags.length ? `Tags: ${tags.join(', ')}` : '', comment.trim()].filter(Boolean).join(' — ')
    setSubmitting(true)
    setError('')
    try {
      await submitRideRating(rideId, score, note || undefined)
      setRated(true)
    } catch (ratingError) {
      setError(friendlyError(ratingError))
    } finally {
      setSubmitting(false)
    }
  }

  if (rated) {
    return (
      <BottomSheet title="Thanks for your feedback" onClose={() => onDone('Thanks for rating your trip.')}>
        <p className="mt-1 text-sm leading-6 text-slate-500">Want to say thanks with a tip? 100% goes to your driver.</p>
        <div className="mt-4"><TipDriver rideId={rideId} onTipped={onDone} /></div>
        <button type="button" onClick={() => onDone('Thanks for rating your trip.')} className="mt-3 h-12 w-full rounded-xl bg-slate-900 text-sm font-bold text-white">Done</button>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="Rate your trip" description="Your feedback keeps NexaGo safe and reliable." onClose={onClose}>
      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 grid gap-4">
        <fieldset>
          <legend className="text-xs font-semibold text-slate-700">How was your driver?</legend>
          <div className="mt-2 flex items-center gap-2" role="group" aria-label="Driver rating from one to five stars">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" onClick={() => chooseScore(value)} aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`} aria-pressed={score === value} className="grid size-11 place-items-center rounded-xl border border-slate-200 transition hover:border-amber-300 hover:bg-amber-50 aria-pressed:border-amber-300 aria-pressed:bg-amber-50">
                <Star size={20} className={score >= value ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} />
              </button>
            ))}
            {score > 0 && <span className="ml-1 text-xs font-semibold text-slate-600">{scoreCopy[score]}</span>}
          </div>
        </fieldset>

        {tagOptions.length > 0 && (
          <fieldset>
            <legend className="text-xs font-semibold text-slate-700">{score >= 4 ? 'What went well?' : 'What could be better?'}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {tagOptions.map((tag) => (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} aria-pressed={tags.includes(tag)} className="h-9 rounded-full border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 transition hover:border-teal-300 aria-pressed:border-teal-700 aria-pressed:bg-teal-50 aria-pressed:text-teal-800">{tag}</button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
          Comment (optional)
          <textarea maxLength={800} value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Tell us more about your trip" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10" />
        </label>

        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">{error}</p>}
        <button type="submit" disabled={submitting || score === 0} className="h-12 rounded-xl bg-teal-800 text-sm font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit rating'}</button>
      </form>
    </BottomSheet>
  )
}
