return {
    DrawRectangle = function(self, x0, y0, x1, y1, color32: number): ()
        if x0 > x1 then x0, x1 = x1, x0 end
	    if y0 > y1 then y0, y1 = y1, y0 end

        local y, y_end = math.max(1, y0), math.max(self.res_y - 1, y1)
        local x, x_end = math.max(1, x0), math.max(self.res_x - 1, x1)

        local count = (x_end - x) + 1
        if count <= 0 or y > y_end then return end

        local byte_count = count * 4

        for cur_y = y, y_end do
            buffer.fill(self.pixel_buffer, (cur_y * self.res_x + x) * 4, color32, byte_count)
        end
    end
}
